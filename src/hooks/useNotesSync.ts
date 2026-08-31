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
  saveConflict: {
    serverContent: string;
    serverRevision: number;
    serverUpdatedAt: string | null;
  } | null;
  handleChange: (next: string) => void;
  acceptServerVersion: () => void;
  overwriteWithLocalVersion: () => void;
  noteData: {
    id: string;
    content: string | null;
    revision?: number;
    updated_at?: string;
  } | null;
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
const SAVE_RETRY_DELAYS_MS = [2_000, 5_000, 15_000] as const;
const NOTES_BEFORE_SIGN_OUT_EVENT = 'parium:flush-pending-notes-before-sign-out';

interface NotesBeforeSignOutDetail {
  waitUntil: (flush: Promise<unknown>) => void;
}

/** Immutable account-bound configuration captured at commit time. */
interface SaveConfig {
  owner: string;
  epoch: number;
  cacheKey: string;
  pendingKey: string;
  revisionKey: string;
}

/** Query result plus the metadata of the exact request that produced it. */
interface NoteQueryPayload {
  meta: { epoch: number; user: string | null; ack: number };
  row: {
    id: string;
    content: string | null;
    revision?: number;
    updated_at?: string;
  } | null;
}

interface SaveConflict {
  serverContent: string;
  serverRevision: number;
  serverUpdatedAt: string | null;
}

type SaveResult =
  | { status: 'saved'; revision: number | null }
  | { status: 'conflict'; conflict: SaveConflict }
  | { status: 'skipped' | 'failed' };

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

function readRevision(revisionKey: string | null): number | null {
  if (!revisionKey) return null;
  const raw = storageGet(revisionKey);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
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
        revisionKey: `${cachePrefix}_${owner}__revision`,
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
  const pendingJournalDurableRef = useRef(false);
  /** True only for a pending journal restored from storage. A fresh edit must
   *  keep the normal debounce even if its baseline query completes nearby. */
  const hydratedPendingNeedsDrainRef = useRef(false);
  const contentRef = useRef('');
  const serverContentRef = useRef('');

  // No authenticated user → no cache key at all. The legacy unscoped
  // `cachePrefix` key is never read or written.
  const userId = user?.id ?? null;
  const cacheKey = userId ? `${cachePrefix}_${userId}` : null;
  const pendingKey = userId ? `${cachePrefix}_${userId}__pending` : null;
  const serverRevisionRef = useRef<number | null>(
    userId ? readRevision(`${cachePrefix}_${userId}__revision`) : null
  );

  // Content state is bound to the session (owner + cache scope) that produced
  // it, so a transition render can never expose the previous session's value.
  const [contentState, setContentState] = useState<{ owner: string | null; scope: string; value: string }>(() => {
    const scope = scopeIdentity(cachePrefix, userId);
    if (!userId) return { owner: null, scope, value: '' };
    const pending = readPending(`${cachePrefix}_${userId}__pending`, userId);
    if (pending !== null) {
      hasLocalEditsRef.current = true;
      pendingJournalDurableRef.current = true;
      hydratedPendingNeedsDrainRef.current = true;
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
  const [saveConflict, setSaveConflict] = useState<SaveConflict | null>(null);

  // Every async completion is scoped to this epoch. Account change bumps it.
  const epochRef = useRef(0);
  /** Committed identity authority. NEVER mutated during render — only in the
   *  committed layout transition effect below. A value produced under another
   *  account can therefore never be relabelled as the current one. */
  const committedUserRef = useRef<string | null>(userId);
  /** Epoch that currently owns an in-flight save (null = idle). Per-epoch so a
   *  stale account's save can never block or acknowledge the next account's. */
  const inFlightEpochRef = useRef<number | null>(null);
  const drainCompletionByEpochRef = useRef(new Map<number, {
    promise: Promise<void>;
    resolve: () => void;
  }>());
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
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const sendKeepaliveRef = useRef<(cfg: SaveConfig) => void>(() => {});
  
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
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

    // Manual logout clears the account-scoped journal before the normal
    // debounce can run. Start the same authenticated keepalive flush used by
    // beforeunload while the previous account/epoch is still authoritative.
    const previousConfig = saveConfigRef.current;
    if (userId === null && isCurrentConfig(previousConfig)) {
      sendKeepaliveRef.current(previousConfig);
    }

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
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
    retryAttemptRef.current = 0;
    hasLocalEditsRef.current = false;
    pendingJournalDurableRef.current = false;
    hydratedPendingNeedsDrainRef.current = false;
    serverContentRef.current = '';
    serverRevisionRef.current = cfg ? readRevision(cfg.revisionKey) : null;
    setSaveFailed(false);
    setSaveConflict(null);
    setLastSaved(null);
    setIsSaving(false);

    let next = '';
    if (userId) {
      const pending = readPending(`${cachePrefix}_${userId}__pending`, userId);
      if (pending !== null) {
        next = pending;
        hasLocalEditsRef.current = true;
        pendingJournalDurableRef.current = true;
        hydratedPendingNeedsDrainRef.current = true;
      } else {
        next = storageGet(`${cachePrefix}_${userId}`) ?? '';
        serverContentRef.current = next;
      }
    }
    contentRef.current = next;
    setContentState({ owner: userId, scope, value: next });

  }, [userId, cachePrefix, isCurrentConfig]);

  // Hydrated pending must enter the normal debounced drain on its own — it may
  // never wait for another edit or a connectivity event.
  useEffect(() => {
    if (!isCurrentConfig(committedConfig)) return;
    if (hydratedPendingNeedsDrainRef.current) scheduleSaveRef.current(committedConfig);
  }, [committedConfig, isCurrentConfig]);


  // Cross-tab sync via localStorage events (clean snapshot only, never while dirty)
  useEffect(() => {
    if (typeof window === 'undefined' || !userId || !cacheKey) return;
    const scopedRevisionKey = `${cacheKey}__revision`;
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
      } else if (
        e.key === scopedRevisionKey &&
        typeof e.newValue === 'string' &&
        !hasLocalEditsRef.current
      ) {
        const nextRevision = Number(e.newValue);
        if (Number.isSafeInteger(nextRevision) && nextRevision >= 0) {
          serverRevisionRef.current = nextRevision;
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cacheKey, userId, commitContent]);

  // Fetch existing note. The metadata is bound to THIS request's result, so a
  // late result from another account/request can never describe another one.
  // The query identity is the COMMITTED SESSION (owner + cache scope + epoch):
  // a same-user cachePrefix change AND an A->logout->A re-login are real
  // session transitions and must each get their own request/metadata, even
  // inside staleTime. Invalidations using the [queryKey, user] prefix match all
  // session keys.
  // Only the committed session may fetch: during a transition render the
  // committed config still describes the previous scope, so no request is
  // started until the layout transition has installed the new session.
  const sessionEpoch =
    isCurrentConfig(committedConfig) && committedConfig.cacheKey === cacheKey
      ? committedConfig.epoch
      : null;
  const { data: queryPayload, isFetched, isSuccess } = useQuery({
    queryKey: [queryKey, userId, cachePrefix, sessionEpoch],

    queryFn: async (): Promise<NoteQueryPayload> => {
      const cfg = committedConfig!;
      const capturedEpoch = cfg.epoch;
      const capturedUser = cfg.owner;
      const capturedAck = ackSeqRef.current;
      const { data, error } = await (supabase
        .from(table) as any)
        .select(table === 'jobseeker_notes' ? 'id, content, revision, updated_at' : 'id, content')
        .eq(ownerColumn, capturedUser)
        .maybeSingle();
      if (error) throw error;
      return {
        meta: { epoch: capturedEpoch, user: capturedUser, ack: capturedAck },
        row: (data as NoteQueryPayload['row']) ?? null,
      };
    },
    enabled: !!userId && sessionEpoch !== null,
    staleTime: 30000,
    refetchOnMount: true,
  });


  const noteData = queryPayload?.row ?? null;

  // The payload that produced the current render (metadata bound to its own request).
  const payloadRef = useRef<NoteQueryPayload | null>(null);
  payloadRef.current = queryPayload ?? null;
  // Value-based dependency: an identical server snapshot is not re-applied.
  const serverValueDep = isSuccess && queryPayload
    ? JSON.stringify({
        content: queryPayload.row?.content ?? '',
        revision: queryPayload.row?.revision ?? 0,
        updatedAt: queryPayload.row?.updated_at ?? null,
      })
    : null;

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
    const serverRevision = table === 'jobseeker_notes'
      ? (payload.row?.revision ?? 0)
      : null;
    serverContentRef.current = serverContent;
    if (!hasLocalEditsRef.current) {
      storageSet(cacheKey, serverContent);
      if (serverRevision !== null) {
        serverRevisionRef.current = serverRevision;
        storageSet(`${cacheKey}__revision`, String(serverRevision));
      }
      contentRef.current = serverContent;
      commitContent(meta.user, meta.epoch, serverContent);
      setSaveConflict(null);
    } else if (table === 'jobseeker_notes' && serverRevision !== null) {
      const cleanSnapshot = storageGet(cacheKey) ?? '';
      const knownRevision = serverRevisionRef.current;
      const adoptServerRevision = () => {
        serverRevisionRef.current = serverRevision;
        storageSet(`${cacheKey}__revision`, String(serverRevision));
      };
      if (serverContent === contentRef.current) {
        // A keepalive/unload save cannot acknowledge localStorage after its
        // response. The next authoritative read closes that journal without a
        // false cross-device conflict when the server already has it verbatim.
        storageSet(cacheKey, serverContent);
        adoptServerRevision();
        const pendingRemoved = storageRemove(`${cacheKey}__pending`);
        if (pendingRemoved) pendingJournalDurableRef.current = false;
        hasLocalEditsRef.current = false;
        hydratedPendingNeedsDrainRef.current = false;
        setSaveConflict(null);
        setSaveFailed(false);
        setLastSaved(new Date());
      } else if (knownRevision === null && cleanSnapshot === serverContent) {
        adoptServerRevision();
        // A user can type while the initial/reconnect query is still pending.
        // The debounce wake then skips because CAS has no revision baseline.
        // Re-arm the existing post-baseline drain so that the edit is saved
        // automatically as soon as this authoritative snapshot arrives.
        hydratedPendingNeedsDrainRef.current = true;
      } else if (
        knownRevision !== null &&
        serverRevision > knownRevision &&
        serverContent === cleanSnapshot
      ) {
        // Another tab/device acknowledged the same clean snapshot. Advance the
        // CAS baseline without treating it as a content conflict.
        adoptServerRevision();
      } else if (
        (knownRevision === null || serverRevision >= knownRevision) &&
        serverContent !== cleanSnapshot
      ) {
        setSaveConflict({
          serverContent,
          serverRevision,
          serverUpdatedAt: payload.row?.updated_at ?? null,
        });
        setSaveFailed(true);
      }
    }
  }, [serverValueDep, cacheKey, userId, commitContent, table]);



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
          const nextRow = payload.new as {
            revision?: unknown;
            content?: unknown;
            updated_at?: unknown;
          } | null;
          const incomingRevision = Number(nextRow?.revision);
          const incomingContent = typeof nextRow?.content === 'string' ? nextRow.content : '';
          const incomingUpdatedAt = typeof nextRow?.updated_at === 'string'
            ? nextRow.updated_at
            : null;
          if (!hasLocalEditsRef.current) {
            const newContent = incomingContent;
            serverContentRef.current = newContent;
            if (table === 'jobseeker_notes' && Number.isSafeInteger(incomingRevision) && incomingRevision >= 0) {
              const currentRevision = serverRevisionRef.current ?? -1;
              if (incomingRevision < currentRevision) return;
              serverRevisionRef.current = incomingRevision;
              storageSet(`${cacheKey}__revision`, String(incomingRevision));
            }
            contentRef.current = newContent;
            commitContent(subUser, subEpoch, newContent);
            if (cacheKey) storageSet(cacheKey, newContent);
            setSaveConflict(null);
          } else if (
            table === 'jobseeker_notes' &&
            Number.isSafeInteger(incomingRevision) &&
            incomingRevision > (serverRevisionRef.current ?? -1)
          ) {
            setSaveConflict({
              serverContent: incomingContent,
              serverRevision: incomingRevision,
              serverUpdatedAt: incomingUpdatedAt,
            });
            setSaveFailed(true);
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
  const saveToDb = useCallback(async (owner: string, contentToSave: string): Promise<SaveResult> => {
    if (!getIsOnline()) return { status: 'skipped' };
    try {
      if (table === 'jobseeker_notes') {
        const expectedRevision = serverRevisionRef.current;
        if (expectedRevision === null) return { status: 'skipped' };
        const { data, error } = await supabase.rpc('save_jobseeker_note', {
          p_content: contentToSave,
          p_expected_revision: expectedRevision,
          p_expected_user_id: owner,
        });
        if (error) {
          console.error(`❌ ${table} save failed:`, error.message);
          return { status: 'failed' };
        }
        const row = (Array.isArray(data) ? data[0] : data) as {
          save_status?: 'saved' | 'already_saved' | 'conflict';
          server_content?: string | null;
          server_revision?: number;
          server_updated_at?: string | null;
        } | null;
        if (!row || !Number.isSafeInteger(row.server_revision) || (row.server_revision ?? -1) < 0) {
          return { status: 'failed' };
        }
        if (row.save_status === 'conflict') {
          return {
            status: 'conflict',
            conflict: {
              serverContent: row.server_content ?? '',
              serverRevision: row.server_revision!,
              serverUpdatedAt: row.server_updated_at ?? null,
            },
          };
        }
        if (row.save_status !== 'saved' && row.save_status !== 'already_saved') {
          return { status: 'failed' };
        }
        return { status: 'saved', revision: row.server_revision! };
      }

      const { error } = await (supabase
        .from(table) as any)
        .upsert(
          { [ownerColumn]: owner, content: contentToSave },
          { onConflict: ownerColumn }
        );
      if (error) {
        console.error(`❌ ${table} save failed:`, error.message);
        return { status: 'failed' };
      }
      return { status: 'saved', revision: null };
    } catch (err) {
      console.error(`Failed to save ${table}:`, err);
      return { status: 'failed' };
    }
  }, [table, ownerColumn]);

  const runDrainRef = useRef<(cfg: SaveConfig) => Promise<void>>(async () => {});
  const scheduleRetryRef = useRef<(cfg: SaveConfig) => void>(() => {});

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
    if (inFlightEpochRef.current === myEpoch) {
      wantedRef.current = true;
      await drainCompletionByEpochRef.current.get(myEpoch)?.promise;
      return;
    }
    if (!hasLocalEditsRef.current || !getIsOnline()) return;

    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    drainCompletionByEpochRef.current.set(myEpoch, { promise: completion, resolve: resolveCompletion });
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
        if (result.status === 'saved') {
          retryAttemptRef.current = 0;
          serverContentRef.current = latest;
          if (result.revision !== null) {
            // The server acknowledgement is authoritative even if this
            // browser currently rejects/quota-blocks localStorage writes.
            serverRevisionRef.current = result.revision;
            storageSet(cfg.revisionKey, String(result.revision));
          }
          // Clean snapshot first; journal removed only on exact revision match.
          const cleanOk = storageSet(cfg.cacheKey, latest);
          // If this browser never managed to create a durable journal (for
          // example storage is blocked in private mode), the authoritative
          // server acknowledgement is still enough to finish the save. A
          // durable journal is retained when the clean snapshot cannot be
          // written, because otherwise that local recovery copy could be
          // discarded without a replacement in browser storage.
          if (!cleanOk && pendingJournalDurableRef.current) {
            setSaveFailed(true);
            break;
          }
          ackSeqRef.current += 1;
          queryClient.invalidateQueries({ queryKey: [queryKey, cfg.owner] });
          if (localRevRef.current === revAtSave) {
            const removed = pendingJournalDurableRef.current
              ? storageRemove(cfg.pendingKey)
              : true;
            if (!removed) { setSaveFailed(true); break; }
            pendingJournalDurableRef.current = false;
            hasLocalEditsRef.current = false;
            setSaveFailed(false);
            setSaveConflict(null);
            setLastSaved(new Date());
            break;
          }
          setLastSaved(new Date());
          continue; // a newer revision exists — save it before acknowledging
        } else if (result.status === 'conflict') {
          retryAttemptRef.current = 0;
          setSaveConflict(result.conflict);
          setSaveFailed(true);
          break;
        } else if (result.status === 'failed') {
          setSaveFailed(true); // pending journal retained
          scheduleRetryRef.current(cfg);
          break;
        } else {
          break; // skipped (offline / no user)
        }
      }
    } finally {
      const completionEntry = drainCompletionByEpochRef.current.get(myEpoch);
      completionEntry?.resolve();
      drainCompletionByEpochRef.current.delete(myEpoch);
      if (inFlightEpochRef.current === myEpoch) inFlightEpochRef.current = null;
      if (isCurrentConfig(cfg) && mountedRef.current) setIsSaving(false);
    }
  }, [isCurrentConfig, saveToDb, queryClient, queryKey]);

  // The drain reference is installed in the COMMIT phase only — never during
  // render — so no abandoned render can swap the function a pending wake calls.
  useLayoutEffect(() => {
    runDrainRef.current = runDrain;
  }, [runDrain]);

  // A short, bounded retry sequence covers transient 5xx/timeouts while
  // avoiding an unbounded client-side write loop. Offline recovery is handled
  // separately by the connectivity subscription below.
  const scheduleRetry = useCallback((cfg: SaveConfig) => {
    if (!isCurrentConfig(cfg) || retryTimeoutRef.current || !getIsOnline()) return;
    const attempt = retryAttemptRef.current;
    if (attempt >= SAVE_RETRY_DELAYS_MS.length) return;
    retryAttemptRef.current = attempt + 1;
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      if (!isCurrentConfig(cfg) || !hasLocalEditsRef.current || !getIsOnline()) return;
      void runDrainRef.current(cfg);
    }, SAVE_RETRY_DELAYS_MS[attempt]);
  }, [isCurrentConfig]);
  scheduleRetryRef.current = scheduleRetry;

  // A rehydrated pending journal cannot safely save until the server baseline
  // (including revision 0 for a missing row) has been fetched. The earlier
  // hydration wake may therefore have been skipped; drain it once the baseline
  // effect above has installed the revision.
  useEffect(() => {
    const cfg = committedConfig;
    if (!isSuccess || !isCurrentConfig(cfg) || !hydratedPendingNeedsDrainRef.current) return;
    if (table === 'jobseeker_notes' && serverRevisionRef.current === null) return;
    hydratedPendingNeedsDrainRef.current = false;
    void runDrainRef.current(cfg);
  }, [isSuccess, queryPayload?.row?.revision, committedConfig, isCurrentConfig, table]);

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
      // The handle is BOUND to the session config it was created with — it can
      // never pick up a newer one. A handle retained from a previous session
      // (other account, other cache scope, or the same account after a
      // logout/login) is therefore fully inert: no ref, status, storage,
      // timer or DB write is touched.
      const cfg = committedConfig;
      if (!isCurrentConfig(cfg)) return;
      hydratedPendingNeedsDrainRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryAttemptRef.current = 0;
      hasLocalEditsRef.current = true;
      localRevRef.current += 1; // same text re-typed is still a newer revision
      contentRef.current = next; // synchronous latest-content authority
      commitContent(cfg.owner, cfg.epoch, next);
      const journaled = writePending(cfg.pendingKey, cfg.owner, next);
      pendingJournalDurableRef.current = pendingJournalDurableRef.current || journaled;
      setSaveFailed(!journaled);
      scheduleSave(cfg);
    },
    [committedConfig, isCurrentConfig, scheduleSave, commitContent]
  );

  /** Explicit conflict resolution only — neither branch silently discards a
   * competing edit. The UI must ask the user which snapshot should win. */
  const acceptServerVersion = useCallback(() => {
    const cfg = committedConfig;
    const conflict = saveConflict;
    if (!isCurrentConfig(cfg) || !conflict) return;
    if (inFlightEpochRef.current === cfg.epoch) return;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }

    // Remove the rejected local journal first. If a known durable journal
    // cannot be removed, do not acknowledge the server choice in memory or
    // cache: otherwise the stale journal can revive and overwrite that choice.
    const pendingRemoved = storageRemove(cfg.pendingKey);
    if (pendingJournalDurableRef.current && !pendingRemoved) {
      setSaveFailed(true);
      return;
    }
    pendingJournalDurableRef.current = false;
    storageSet(cfg.cacheKey, conflict.serverContent);
    storageSet(cfg.revisionKey, String(conflict.serverRevision));

    retryAttemptRef.current = 0;
    hasLocalEditsRef.current = false;
    localRevRef.current += 1;
    contentRef.current = conflict.serverContent;
    serverContentRef.current = conflict.serverContent;
    serverRevisionRef.current = conflict.serverRevision;
    commitContent(cfg.owner, cfg.epoch, conflict.serverContent);
    setSaveConflict(null);
    setSaveFailed(false);
    setLastSaved(null);
  }, [committedConfig, saveConflict, isCurrentConfig, commitContent]);

  const overwriteWithLocalVersion = useCallback(() => {
    const cfg = committedConfig;
    const conflict = saveConflict;
    if (!isCurrentConfig(cfg) || !conflict || !hasLocalEditsRef.current) return;
    if (inFlightEpochRef.current === cfg.epoch) return;
    storageSet(cfg.revisionKey, String(conflict.serverRevision));
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
    retryAttemptRef.current = 0;
    serverContentRef.current = conflict.serverContent;
    serverRevisionRef.current = conflict.serverRevision;
    setSaveConflict(null);
    setSaveFailed(false);
    void runDrainRef.current(cfg);
  }, [committedConfig, saveConflict, isCurrentConfig]);

  // Retry queued save when coming back online. The wake is bound to the config
  // committed at subscription time and becomes inert after a transition.
  useEffect(() => {
    const cfg = committedConfig;
    if (!isCurrentConfig(cfg)) return;
    const unsub = onConnectivityChange((online) => {
      if (!isCurrentConfig(cfg)) return;
      if (online && hasLocalEditsRef.current) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        retryAttemptRef.current = 0;
        void runDrainRef.current(cfg);
      }
    });
    return unsub;
  }, [committedConfig, isCurrentConfig]);

  // Explicit logout is awaitable (unlike beforeunload). Register the normal
  // authenticated drain so large notes and a newer edit queued behind an
  // active save finish before AuthProvider clears account-scoped journals.
  useEffect(() => {
    const cfg = committedConfig;
    if (!isCurrentConfig(cfg)) return;
    const handleBeforeSignOut = (event: Event) => {
      if (!isCurrentConfig(cfg)) return;
      const detail = (event as CustomEvent<NotesBeforeSignOutDetail>).detail;
      if (!detail || typeof detail.waitUntil !== 'function') return;
      detail.waitUntil((async () => {
        await runDrainRef.current(cfg);
        if (isCurrentConfig(cfg) && hasLocalEditsRef.current) {
          throw new Error('pending note was not saved');
        }
      })());
    };
    window.addEventListener(NOTES_BEFORE_SIGN_OUT_EVENT, handleBeforeSignOut);
    return () => window.removeEventListener(NOTES_BEFORE_SIGN_OUT_EVENT, handleBeforeSignOut);
  }, [committedConfig, isCurrentConfig]);


  // Keep a ref to the latest access token for beforeunload. Bound to the
  // COMMITTED session config (owner + cache scope + epoch), so a scope change
  // for the same user re-arms the token instead of leaving it cleared.
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    accessTokenRef.current = null; // never carry a previous session's token
    const cfg = committedConfig;
    if (!isCurrentConfig(cfg)) return;
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isCurrentConfig(cfg)) return;
      accessTokenRef.current = data.session?.access_token ?? null;
    };
    void sync();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // A callback retained from a previous session/scope is inert.
      if (!isCurrentConfig(cfg)) return;
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => {
      accessTokenRef.current = null;
      subscription.unsubscribe();
    };
  }, [committedConfig, isCurrentConfig]);

  const sendPendingKeepalive = useCallback((cfg: SaveConfig) => {
    if (!isCurrentConfig(cfg)) return;
    if (!hasLocalEditsRef.current) return;
    if (inFlightEpochRef.current === cfg.epoch) return;
    const token = accessTokenRef.current;
    if (!token) return;
    const expectedRevision = serverRevisionRef.current;
    if (table === 'jobseeker_notes' && expectedRevision === null) return;
    const body = table === 'jobseeker_notes'
      ? JSON.stringify({
        p_content: contentRef.current,
        p_expected_revision: expectedRevision,
        p_expected_user_id: cfg.owner,
      })
      : JSON.stringify({ [ownerColumn]: cfg.owner, content: contentRef.current });
    const url = table === 'jobseeker_notes'
      ? `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/save_jobseeker_note`
      : `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}?on_conflict=${ownerColumn}`;

    const headers = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${token}`,
      ...(table === 'jobseeker_notes'
        ? {}
        : { 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
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
  }, [isCurrentConfig, ownerColumn, table]);

  useLayoutEffect(() => {
    sendKeepaliveRef.current = sendPendingKeepalive;
  }, [sendPendingKeepalive]);

  // beforeunload — flush unsaved changes through the account-bound endpoint.
  // Bound to the current immutable config; a listener retained from a previous
  // session/scope is inert and can never send the old owner or old content.
  useEffect(() => {
    const cfg = committedConfig;
    if (!isCurrentConfig(cfg)) return;
    const handleBeforeUnload = () => sendPendingKeepalive(cfg);

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [committedConfig, isCurrentConfig, sendPendingKeepalive]);


  // Identity guard: until the reset/hydration has bound state to the current
  // session (owner + cache scope), the public snapshot must never expose the
  // previous session.
  const identityMatched =
    contentState.owner === userId && contentState.scope === scopeIdentity(cachePrefix, userId);
  const visibleContent = identityMatched ? content : userId ? peekScoped(cachePrefix, userId) : '';


  return {
    content: visibleContent,
    isSaving: identityMatched ? isSaving : false,
    saveFailed: identityMatched ? saveFailed : false,
    lastSaved: identityMatched ? lastSaved : null,
    saveConflict: identityMatched ? saveConflict : null,
    handleChange,
    acceptServerVersion,
    overwriteWithLocalVersion,
    noteData: identityMatched ? noteData ?? null : null,
    isFetched: identityMatched ? isFetched : false,
  };
}
