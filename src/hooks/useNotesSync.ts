import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getIsOnline, onConnectivityChange } from '@/lib/connectivityManager';
import { safeSetItem } from '@/lib/safeStorage';

type NoteTable = 'employer_notes' | 'jobseeker_notes';
type OwnerColumn = 'employer_id' | 'user_id';

interface UseNotesSyncOptions {
  table: NoteTable;
  ownerColumn: OwnerColumn;
  cachePrefix: string;
  queryKey: string;
}

interface NotesSyncResult {
  content: string;
  isSaving: boolean;
  saveFailed: boolean;
  lastSaved: Date | null;
  handleChange: (next: string) => void;
  noteData: { id: string; content: string | null } | null;
  isFetched: boolean;
}

/** Versioned journal envelope for unsaved edits. */
const PENDING_VERSION = 1;
interface PendingEnvelope {
  v: number;
  u: string;
  c: string;
  t: number;
}

const SAVE_DEBOUNCE_MS = 1200;

/** Query result plus the metadata of the exact request that produced it. */
interface NoteQueryPayload {
  meta: { epoch: number; user: string | null; ack: number };
  row: { id: string; content: string | null } | null;
}

// ---- exception-safe storage primitives (private/incognito browsers) ----
function storageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return safeSetItem(key, value);
  } catch {
    return false;
  }
}
function storageRemove(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readPending(pendingKey: string | null, userId: string | null): string | null {
  if (!pendingKey || !userId) return null;
  const raw = storageGet(pendingKey);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as PendingEnvelope).v !== PENDING_VERSION ||
      (parsed as PendingEnvelope).u !== userId ||
      typeof (parsed as PendingEnvelope).c !== 'string'
    ) {
      storageRemove(pendingKey);
      return null;
    }
    return (parsed as PendingEnvelope).c;
  } catch {
    storageRemove(pendingKey);
    return null;
  }
}

function writePending(pendingKey: string, userId: string, content: string): boolean {
  const env: PendingEnvelope = { v: PENDING_VERSION, u: userId, c: content, t: Date.now() };
  try {
    return storageSet(pendingKey, JSON.stringify(env));
  } catch {
    return false;
  }
}

export function useNotesSync({ table, ownerColumn, cachePrefix, queryKey }: UseNotesSyncOptions): NotesSyncResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasLocalEditsRef = useRef(false);
  const contentRef = useRef('');
  const serverContentRef = useRef('');

  // No authenticated user → no cache key at all. The legacy unscoped
  // `cachePrefix` key is never read or written.
  const userId = user?.id ?? null;
  const cacheKey = userId ? `${cachePrefix}_${userId}` : null;
  const pendingKey = userId ? `${cachePrefix}_${userId}__pending` : null;

  const [content, setContent] = useState(() => {
    if (!userId) return '';
    const pending = readPending(`${cachePrefix}_${userId}__pending`, userId);
    if (pending !== null) {
      hasLocalEditsRef.current = true;
      contentRef.current = pending;
      return pending;
    }
    const clean = storageGet(`${cachePrefix}_${userId}`) ?? '';
    contentRef.current = clean;
    serverContentRef.current = clean;
    return clean;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Every async completion is scoped to this epoch. Account change bumps it.
  const epochRef = useRef(0);
  /** Epoch that currently owns an in-flight save (null = idle). Per-epoch so a
   *  stale account's save can never block or acknowledge the next account's. */
  const inFlightEpochRef = useRef<number | null>(null);
  /** Monotonic local revision — every edit (even same text) is a new revision. */
  const localRevRef = useRef(0);
  /** Monotonic count of acknowledged saves — used to reject stale query results. */
  const ackSeqRef = useRef(0);
  const wantedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, []);

  // Account transition (null->uid, A->B, uid->null): reset all account-local
  // state and hydrate ONLY the new user's pending/clean caches.
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (previousUserIdRef.current === userId) return;
    const isFirst = previousUserIdRef.current === undefined;
    previousUserIdRef.current = userId;
    if (isFirst) return; // lazy initializer already hydrated

    epochRef.current += 1;
    localRevRef.current += 1;
    ackSeqRef.current += 1;
    accessTokenRef.current = null;
    wantedRef.current = false;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    hasLocalEditsRef.current = false;
    serverContentRef.current = '';
    setSaveFailed(false);
    setLastSaved(null);
    setIsSaving(false);

    let next = '';
    if (userId) {
      const pending = readPending(`${cachePrefix}_${userId}__pending`, userId);
      if (pending !== null) {
        next = pending;
        hasLocalEditsRef.current = true;
      } else {
        next = storageGet(`${cachePrefix}_${userId}`) ?? '';
        serverContentRef.current = next;
      }
    }
    contentRef.current = next;
    setContent(next);
  }, [userId, cachePrefix]);

  // Hydrated pending must enter the normal debounced drain on its own — it may
  // never wait for another edit or a connectivity event.
  useEffect(() => {
    if (!userId) return;
    if (hasLocalEditsRef.current) scheduleSaveRef.current();
  }, [userId]);

  // Cross-tab sync via localStorage events (clean snapshot only, never while dirty)
  useEffect(() => {
    if (typeof window === 'undefined' || !userId || !cacheKey) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === cacheKey && typeof e.newValue === 'string') {
        if (!hasLocalEditsRef.current) {
          contentRef.current = e.newValue;
          serverContentRef.current = e.newValue;
          setContent(e.newValue);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cacheKey, userId]);

  // Fetch existing note. The metadata is bound to THIS request's result, so a
  // late result from another account/request can never describe another one.
  const { data: queryPayload, isFetched, isSuccess } = useQuery({
    queryKey: [queryKey, userId],
    queryFn: async (): Promise<NoteQueryPayload> => {
      const capturedEpoch = epochRef.current;
      const capturedUser = userId;
      const capturedAck = ackSeqRef.current;
      const { data, error } = await (supabase
        .from(table) as any)
        .select('id, content')
        .eq(ownerColumn, userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        meta: { epoch: capturedEpoch, user: capturedUser, ack: capturedAck },
        row: (data as { id: string; content: string | null } | null) ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 30000,
    refetchOnMount: true,
  });

  const noteData = queryPayload?.row ?? null;

  // The payload that produced the current render (metadata bound to its own request).
  const payloadRef = useRef<NoteQueryPayload | null>(null);
  payloadRef.current = queryPayload ?? null;
  // Value-based dependency: an identical server snapshot is not re-applied.
  const serverValueDep = isSuccess && queryPayload ? (queryPayload.row?.content ?? '') : null;

  // Sync server value into clean cache — ONLY on a successful query.
  useEffect(() => {
    if (!userId || !cacheKey) return;
    if (serverValueDep === null) return; // query errors are never a "successful empty note"
    const payload = payloadRef.current;
    if (!payload) return;
    const meta = payload.meta;
    // A read that started before the last acknowledged local save is stale.
    if (meta.epoch !== epochRef.current || meta.user !== userId || meta.ack !== ackSeqRef.current) return;
    const serverContent = payload.row?.content ?? '';
    serverContentRef.current = serverContent;
    if (!hasLocalEditsRef.current) {
      storageSet(cacheKey, serverContent);
      contentRef.current = serverContent;
      setContent(serverContent);
    }
  }, [serverValueDep, cacheKey, userId]);



  // Realtime sync — listen for changes from other devices
  useEffect(() => {
    if (!userId) return;
    const subEpoch = epochRef.current;
    const subUser = userId;
    const channel = createRealtimeChannel(`${table}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${ownerColumn}=eq.${userId}`,
        },
        (payload) => {
          // Late callback from a previous account/session must be discarded.
          if (epochRef.current !== subEpoch || subUser !== userId) return;
          if (!hasLocalEditsRef.current) {
            const newContent = (payload.new as any)?.content ?? '';
            serverContentRef.current = newContent;
            contentRef.current = newContent;
            setContent(newContent);
            if (cacheKey) storageSet(cacheKey, newContent);
          }
          queryClient.invalidateQueries({ queryKey: [queryKey, userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, cacheKey, queryClient, table, ownerColumn, queryKey]);

  // Save function — always upserts to avoid duplicates
  const saveToDb = useCallback(async (contentToSave: string): Promise<'saved' | 'skipped' | 'failed'> => {
    if (!userId || !getIsOnline()) return 'skipped';
    try {
      const { error } = await (supabase
        .from(table) as any)
        .upsert(
          { [ownerColumn]: userId, content: contentToSave },
          { onConflict: ownerColumn }
        );
      if (error) {
        console.error(`❌ ${table} save failed:`, error.message);
        return 'failed';
      }
      return 'saved';
    } catch (err) {
      console.error(`Failed to save ${table}:`, err);
      return 'failed';
    }
  }, [userId, table, ownerColumn]);

  /**
   * Single-flight, lost-wakeup-safe save drain. Debounce and reconnect both
   * funnel through here, so intermediate edits coalesce to the latest value
   * and there is never a concurrent duplicate save or a retry spin.
   */
  const drainRef = useRef<() => Promise<void>>(async () => {});
  drainRef.current = async () => {
    const myEpoch = epochRef.current;
    if (inFlightEpochRef.current === myEpoch) { wantedRef.current = true; return; }
    if (!userId || !cacheKey || !pendingKey) return;
    if (!hasLocalEditsRef.current || !getIsOnline()) return;

    inFlightEpochRef.current = myEpoch;
    setIsSaving(true);
    try {
      for (;;) {
        wantedRef.current = false;
        if (epochRef.current !== myEpoch) return;
        if (!hasLocalEditsRef.current || !getIsOnline()) break;
        const latest = contentRef.current;
        const revAtSave = localRevRef.current;
        const result = await saveToDb(latest);
        if (epochRef.current !== myEpoch || !mountedRef.current) return; // account switched / unmounted
        if (result === 'saved') {
          // Clean snapshot first; journal removed only on exact revision match.
          const cleanOk = storageSet(cacheKey, latest);
          if (!cleanOk) { setSaveFailed(true); break; } // retain pending + dirty, no retry spin
          serverContentRef.current = latest;
          ackSeqRef.current += 1;
          queryClient.invalidateQueries({ queryKey: [queryKey, userId] });
          if (localRevRef.current === revAtSave) {
            const removed = storageRemove(pendingKey);
            if (!removed) { setSaveFailed(true); break; }
            hasLocalEditsRef.current = false;
            setSaveFailed(false);
            setLastSaved(new Date());
            break;
          }
          setLastSaved(new Date());
          continue; // a newer revision exists — save it before acknowledging
        } else if (result === 'failed') {
          setSaveFailed(true); // pending journal retained
          break;
        } else {
          break; // skipped (offline / no user)
        }
      }
    } finally {
      if (inFlightEpochRef.current === myEpoch) inFlightEpochRef.current = null;
      if (epochRef.current === myEpoch && mountedRef.current) setIsSaving(false);
    }
  };

  const scheduleSaveRef = useRef<() => void>(() => {});
  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void drainRef.current();
    }, SAVE_DEBOUNCE_MS);
  }, []);
  scheduleSaveRef.current = scheduleSave;

  const handleChange = useCallback(
    (next: string) => {
      // No authenticated user → no cache key → ignore edits entirely.
      if (!cacheKey || !pendingKey || !userId) return;
      hasLocalEditsRef.current = true;
      localRevRef.current += 1; // same text re-typed is still a newer revision
      contentRef.current = next; // synchronous latest-content authority
      setContent(next);
      const journaled = writePending(pendingKey, userId, next);
      setSaveFailed(!journaled);
      scheduleSave();
    },
    [cacheKey, pendingKey, userId, scheduleSave]
  );

  // Retry queued save when coming back online
  useEffect(() => {
    if (!userId) return;
    const unsub = onConnectivityChange((online) => {
      if (online && hasLocalEditsRef.current) {
        void drainRef.current();
      }
    });
    return unsub;
  }, [userId]);

  // Keep a ref to the latest access token for beforeunload
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    accessTokenRef.current = null; // never carry a previous account's token
    if (!userId) return;
    const myEpoch = epochRef.current;
    const myUser = userId;
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (epochRef.current !== myEpoch || myUser !== userId) return;
      accessTokenRef.current = data.session?.access_token ?? null;
    };
    void sync();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (epochRef.current !== myEpoch || myUser !== userId) return;
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => {
      accessTokenRef.current = null;
      subscription.unsubscribe();
    };
  }, [userId]);

  // beforeunload — flush unsaved changes via PostgREST upsert.
  // Never competes with an in-flight save; the pending journal stays as fallback.
  useEffect(() => {
    if (!userId) return;
    const handleBeforeUnload = () => {
      if (!hasLocalEditsRef.current) return;
      if (inFlightEpochRef.current === epochRef.current) return;
      const token = accessTokenRef.current;
      if (!token) return;
      const body = JSON.stringify({ [ownerColumn]: userId, content: contentRef.current });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}?on_conflict=${ownerColumn}`;

      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal,resolution=merge-duplicates',
      };

      try {
        void fetch(url, {
          method: 'POST',
          headers,
          body,
          keepalive: true,
        }).catch(() => {
          // pending journal already holds the latest content as fallback
        });
      } catch {
        // pending journal already holds the latest content as fallback
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [userId, table, ownerColumn]);

  return { content, isSaving, saveFailed, lastSaved, handleChange, noteData: noteData ?? null, isFetched };
}
