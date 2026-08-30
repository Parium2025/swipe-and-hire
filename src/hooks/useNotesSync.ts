import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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

/** Immutable account-bound configuration captured at commit time. */
interface SaveConfig {
  owner: string;
  epoch: number;
  cacheKey: string;
  pendingKey: string;
}

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

/** Pure, side-effect free scoped read used to mask the identity-transition render. */
function peekScoped(cachePrefix: string, userId: string): string {
  const raw = storageGet(`${cachePrefix}_${userId}__pending`);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as PendingEnvelope;
      if (parsed && parsed.v === PENDING_VERSION && parsed.u === userId && typeof parsed.c === 'string') {
        return parsed.c;
      }
    } catch {
      /* fall through to the clean snapshot */
    }
  }
  return storageGet(`${cachePrefix}_${userId}`) ?? '';
}

/** Immutable config for one committed (owner + cache scope + epoch) session. */
function makeSaveConfig(owner: string | null, cachePrefix: string, epoch: number): SaveConfig | null {
  return owner
    ? {
        owner,
        epoch,
        cacheKey: `${cachePrefix}_${owner}`,
        pendingKey: `${cachePrefix}_${owner}__pending`,
      }
    : null;
}

/** Scope identity: owner AND cache scope. A change in either is a transition. */
function scopeIdentity(cachePrefix: string, userId: string | null): string {
  return `${cachePrefix}\u0000${userId ?? ''}`;
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

  // Content state is bound to the session (owner + cache scope) that produced
  // it, so a transition render can never expose the previous session's value.
  const [contentState, setContentState] = useState<{ owner: string | null; scope: string; value: string }>(() => {
    const scope = scopeIdentity(cachePrefix, userId);
    if (!userId) return { owner: null, scope, value: '' };
    const pending = readPending(`${cachePrefix}_${userId}__pending`, userId);
    if (pending !== null) {
      hasLocalEditsRef.current = true;
      contentRef.current = pending;
      return { owner: userId, scope, value: pending };
    }
    const clean = storageGet(`${cachePrefix}_${userId}`) ?? '';
    contentRef.current = clean;
    serverContentRef.current = clean;
    return { owner: userId, scope, value: clean };
  });
  const content = contentState.value;


  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Every async completion is scoped to this epoch. Account change bumps it.
  const epochRef = useRef(0);
  /** Committed identity authority. NEVER mutated during render — only in the
   *  committed layout transition effect below. A value produced under another
   *  account can therefore never be relabelled as the current one. */
  const committedUserRef = useRef<string | null>(userId);
  /** Epoch that currently owns an in-flight save (null = idle). Per-epoch so a
   *  stale account's save can never block or acknowledge the next account's. */
  const inFlightEpochRef = useRef<number | null>(null);
  /** Monotonic local revision — every edit (even same text) is a new revision. */
  const localRevRef = useRef(0);
  /** Monotonic count of acknowledged saves — used to reject stale query results. */
  const ackSeqRef = useRef(0);

  /**
   * Immutable session configuration (owner + cache scope + epoch). It is
   * installed ONLY in the commit phase (layout effect), never during render,
   * and every scheduled operation and exposed callback carries the exact
   * object it was created with. A timer, wake or handle created in one session
   * therefore stays bound to that session and can never execute with another
   * owner/scope/epoch.
   */
  const saveConfigRef = useRef<SaveConfig | null>(makeSaveConfig(userId, cachePrefix, 0));
  const [committedConfig, setCommittedConfig] = useState<SaveConfig | null>(() => saveConfigRef.current);

  /** True only when `cfg` still describes the committed session. */
  const isCurrentConfig = useCallback(
    (cfg: SaveConfig | null): cfg is SaveConfig =>
      !!cfg && cfg.owner === committedUserRef.current && cfg.epoch === epochRef.current,
    []
  );

  /** The committed scope identity — mutated only in the layout transition. */
  const committedScopeRef = useRef<string>(scopeIdentity(cachePrefix, userId));

  /** Commit a content value only when its source still owns the committed
   *  identity AND epoch. Every caller passes the owner/epoch it captured. */
  const commitContent = useCallback((owner: string | null, epoch: number, next: string) => {
    if (owner !== committedUserRef.current) return;
    if (epoch !== epochRef.current) return;
    setContentState({ owner, scope: committedScopeRef.current, value: next });
  }, []);

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

  // Session transition (null->uid, A->B, uid->null, A->logout->A, or the SAME
  // user under a new cache scope): reset all session-local state and hydrate
  // ONLY the new scope's pending/clean caches.
  const previousScopeRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const scope = scopeIdentity(cachePrefix, userId);
    if (previousScopeRef.current === scope) return;
    const isFirst = previousScopeRef.current === undefined;
    previousScopeRef.current = scope;
    if (isFirst) return; // lazy initializers already hydrated content + config

    epochRef.current += 1;
    committedUserRef.current = userId;
    committedScopeRef.current = scope;
    const cfg = makeSaveConfig(userId, cachePrefix, epochRef.current);
    saveConfigRef.current = cfg;
    setCommittedConfig(cfg);
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
    setContentState({ owner: userId, scope, value: next });

  }, [userId, cachePrefix]);

  // Hydrated pending must enter the normal debounced drain on its own — it may
  // never wait for another edit or a connectivity event.
  useEffect(() => {
    if (!isCurrentConfig(committedConfig)) return;
    if (hasLocalEditsRef.current) scheduleSaveRef.current(committedConfig);
  }, [committedConfig, isCurrentConfig]);


  // Cross-tab sync via localStorage events (clean snapshot only, never while dirty)
  useEffect(() => {
    if (typeof window === 'undefined' || !userId || !cacheKey) return;
    // The owner/epoch this listener belongs to. A late event delivered after an
    // account transition is rejected instead of relabelled.
    const subUser = userId;
    const subEpoch = epochRef.current;
    const onStorage = (e: StorageEvent) => {
      if (subUser !== committedUserRef.current || subEpoch !== epochRef.current) return;
      if (e.key === cacheKey && typeof e.newValue === 'string') {
        if (!hasLocalEditsRef.current) {
          contentRef.current = e.newValue;
          serverContentRef.current = e.newValue;
          commitContent(subUser, subEpoch, e.newValue);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cacheKey, userId, commitContent]);

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
      commitContent(meta.user, meta.epoch, serverContent);
    }
  }, [serverValueDep, cacheKey, userId, commitContent]);



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
          if (epochRef.current !== subEpoch || subUser !== committedUserRef.current) return;
          if (!hasLocalEditsRef.current) {
            const newContent = (payload.new as any)?.content ?? '';
            serverContentRef.current = newContent;
            contentRef.current = newContent;
            commitContent(subUser, subEpoch, newContent);
            if (cacheKey) storageSet(cacheKey, newContent);
          }
          queryClient.invalidateQueries({ queryKey: [queryKey, userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, cacheKey, queryClient, table, ownerColumn, queryKey, commitContent]);

  // Save function — always upserts to avoid duplicates. The owner is passed in
  // explicitly by the caller's immutable config; it is never read from render.
  const saveToDb = useCallback(async (owner: string, contentToSave: string): Promise<'saved' | 'skipped' | 'failed'> => {
    if (!getIsOnline()) return 'skipped';
    try {
      const { error } = await (supabase
        .from(table) as any)
        .upsert(
          { [ownerColumn]: owner, content: contentToSave },
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
  }, [table, ownerColumn]);

  /**
   * Single-flight, lost-wakeup-safe save drain. Debounce and reconnect both
   * funnel through here, so intermediate edits coalesce to the latest value
   * and there is never a concurrent duplicate save or a retry spin.
   *
   * The account configuration arrives as an immutable argument captured when
   * the wake was created, and is re-validated against the committed identity
   * and epoch before and after every await. A wake created under A can never
   * run with B's owner or keys.
   */
  const runDrain = useCallback(async (cfg: SaveConfig) => {
    if (!isCurrentConfig(cfg)) return;
    const myEpoch = cfg.epoch;
    if (inFlightEpochRef.current === myEpoch) { wantedRef.current = true; return; }
    if (!hasLocalEditsRef.current || !getIsOnline()) return;

    inFlightEpochRef.current = myEpoch;
    setIsSaving(true);
    try {
      for (;;) {
        wantedRef.current = false;
        if (!isCurrentConfig(cfg)) return;
        if (!hasLocalEditsRef.current || !getIsOnline()) break;
        const latest = contentRef.current;
        const revAtSave = localRevRef.current;
        const result = await saveToDb(cfg.owner, latest);
        // account switched / unmounted
        if (!isCurrentConfig(cfg) || !mountedRef.current) return;
        if (result === 'saved') {
          // Clean snapshot first; journal removed only on exact revision match.
          const cleanOk = storageSet(cfg.cacheKey, latest);
          if (!cleanOk) { setSaveFailed(true); break; } // retain pending + dirty, no retry spin
          serverContentRef.current = latest;
          ackSeqRef.current += 1;
          queryClient.invalidateQueries({ queryKey: [queryKey, cfg.owner] });
          if (localRevRef.current === revAtSave) {
            const removed = storageRemove(cfg.pendingKey);
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
      if (isCurrentConfig(cfg) && mountedRef.current) setIsSaving(false);
    }
  }, [isCurrentConfig, saveToDb, queryClient, queryKey]);

  // The drain reference is installed in the COMMIT phase only — never during
  // render — so no abandoned render can swap the function a pending wake calls.
  const runDrainRef = useRef<(cfg: SaveConfig) => Promise<void>>(async () => {});
  useLayoutEffect(() => {
    runDrainRef.current = runDrain;
  }, [runDrain]);

  const scheduleSaveRef = useRef<(cfg: SaveConfig) => void>(() => {});
  const scheduleSave = useCallback((cfg: SaveConfig) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      // The timer carries A's config; after a transition it is a no-op.
      void runDrainRef.current(cfg);
    }, SAVE_DEBOUNCE_MS);
  }, []);
  scheduleSaveRef.current = scheduleSave;

  const handleChange = useCallback(
    (next: string) => {
      // Ownership is verified BEFORE any shared ref, status, storage or timer
      // is touched: a handle retained from another account is fully inert.
      const cfg = saveConfigRef.current;
      if (!userId || !isCurrentConfig(cfg) || cfg.owner !== userId) return;
      hasLocalEditsRef.current = true;
      localRevRef.current += 1; // same text re-typed is still a newer revision
      contentRef.current = next; // synchronous latest-content authority
      commitContent(cfg.owner, cfg.epoch, next);
      const journaled = writePending(cfg.pendingKey, cfg.owner, next);
      setSaveFailed(!journaled);
      scheduleSave(cfg);
    },
    [userId, isCurrentConfig, scheduleSave, commitContent]
  );

  // Retry queued save when coming back online. The wake is bound to the config
  // committed at subscription time and becomes inert after a transition.
  useEffect(() => {
    if (!userId) return;
    const cfg = saveConfigRef.current;
    if (!cfg || cfg.owner !== userId) return;
    const unsub = onConnectivityChange((online) => {
      if (!isCurrentConfig(cfg)) return;
      if (online && hasLocalEditsRef.current) {
        void runDrainRef.current(cfg);
      }
    });
    return unsub;
  }, [userId, isCurrentConfig]);

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

  // Identity guard: until the reset/hydration has bound state to the current
  // account, the public snapshot must never expose the previous account.
  const identityMatched = contentState.owner === userId;
  const visibleContent = identityMatched ? content : userId ? peekScoped(cachePrefix, userId) : '';

  return {
    content: visibleContent,
    isSaving: identityMatched ? isSaving : false,
    saveFailed: identityMatched ? saveFailed : false,
    lastSaved: identityMatched ? lastSaved : null,
    handleChange,
    noteData: identityMatched ? noteData ?? null : null,
    isFetched: identityMatched ? isFetched : false,
  };
}
