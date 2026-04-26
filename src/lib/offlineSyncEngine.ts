/**
 * 🔄 OFFLINE SYNC ENGINE
 * 
 * Centralized offline sync with three key improvements:
 * 
 * 1. CONFLICT RESOLUTION (Last-Write-Wins with timestamps)
 *    - Every queued operation carries a `queuedAt` timestamp
 *    - Before writing, checks server `updated_at` to detect conflicts
 *    - If server data is newer, the queued op is dropped (server wins)
 *    - If queued op is newer, it overwrites (client wins)
 * 
 * 2. SERVICE WORKER BACKGROUND SYNC
 *    - Registers sync events so queued ops are flushed even when the
 *      app tab is closed/backgrounded (requires SW support)
 *    - Falls back to in-app ConnectivityManager when SW sync unavailable
 * 
 * 3. SELECTIVE DATA SYNC
 *    - Tracks a `lastSyncedAt` timestamp per data domain
 *    - On reconnection, only fetches rows updated since last sync
 *    - Dramatically reduces bandwidth on reconnection
 */

import { supabase } from '@/integrations/supabase/client';
import { getIsOnline, onConnectivityChange } from './connectivityManager';

// ─── 1. CONFLICT RESOLUTION ─────────────────────────────────────────

/**
 * Check if a queued operation is still valid by comparing timestamps.
 * Returns true if the queued op should be applied (client wins).
 * Returns false if server data is newer (server wins, drop queued op).
 */
export async function shouldApplyQueuedOp(
  table: string,
  recordId: string,
  queuedAt: number,
  idColumn = 'id'
): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from(table)
      .select('updated_at')
      .eq(idColumn, recordId)
      .maybeSingle();

    if (error || !data?.updated_at) {
      // Record doesn't exist or no updated_at — apply the op
      return true;
    }

    const serverUpdatedAt = new Date(data.updated_at).getTime();
    
    // Client wins only if its timestamp is newer than server
    return queuedAt > serverUpdatedAt;
  } catch {
    // On error, be optimistic and apply
    return true;
  }
}

/**
 * Execute a queued operation with conflict checking.
 * Wraps the actual DB call with a timestamp guard.
 */
export async function executeWithConflictCheck<T>(
  table: string,
  recordId: string,
  queuedAt: number,
  operation: () => Promise<T>,
  idColumn = 'id'
): Promise<{ applied: boolean; result?: T; reason?: 'conflict' | 'error' }> {
  const shouldApply = await shouldApplyQueuedOp(table, recordId, queuedAt, idColumn);
  
  if (!shouldApply) {
    console.log(`[SyncEngine] Conflict detected for ${table}/${recordId} — server is newer, dropping queued op`);
    return { applied: false, reason: 'conflict' };
  }

  try {
    const result = await operation();
    return { applied: true, result };
  } catch (err) {
    console.error(`[SyncEngine] Operation failed for ${table}/${recordId}:`, err);
    return { applied: false, reason: 'error' };
  }
}

// ─── 2. BACKGROUND SYNC (DISABLED) ──────────────────────────────

/**
 * Service Worker background sync är avstängd. Offlineköer flushas i appen via
 * ConnectivityManager så vi inte återintroducerar en SW som kan cacha landing.
 */
export async function requestBackgroundSync(): Promise<boolean> {
  return false;
}

export function notifySwOfPendingOps(): void {
  // no-op by design
}

// ─── 3. SELECTIVE DATA SYNC ─────────────────────────────────────────

const SYNC_TIMESTAMPS_KEY = 'parium_sync_timestamps';

interface SyncTimestamps {
  [domain: string]: string; // ISO timestamp of last successful sync
}

function getSyncTimestamps(): SyncTimestamps {
  try {
    const raw = localStorage.getItem(SYNC_TIMESTAMPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      try { localStorage.removeItem(SYNC_TIMESTAMPS_KEY); } catch { /* ignore */ }
      return {};
    }
    return parsed as SyncTimestamps;
  } catch {
    try { localStorage.removeItem(SYNC_TIMESTAMPS_KEY); } catch { /* ignore */ }
    return {};
  }
}

function setSyncTimestamp(domain: string, timestamp: string): void {
  try {
    const timestamps = getSyncTimestamps();
    timestamps[domain] = timestamp;
    localStorage.setItem(SYNC_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  } catch {
    console.warn('[SyncEngine] Failed to save sync timestamp');
  }
}

/**
 * Get the last sync timestamp for a data domain.
 * Returns null if never synced (will trigger a full fetch).
 */
export function getLastSyncTime(domain: string): string | null {
  const timestamps = getSyncTimestamps();
  return timestamps[domain] || null;
}

/**
 * Record that a data domain was successfully synced.
 */
export function recordSyncComplete(domain: string): void {
  setSyncTimestamp(domain, new Date().toISOString());
}

/**
 * Fetch only rows updated since last sync for a given table.
 * Falls back to full fetch if no previous sync timestamp exists.
 * 
 * @param table - Supabase table name
 * @param domain - Sync domain key (e.g. 'conversations', 'jobs')
 * @param selectColumns - Columns to select
 * @param additionalFilters - Function to add extra .eq/.in filters
 * @returns The fetched data and whether it was a partial or full sync
 */
export async function fetchSinceLastSync<T>(
  table: string,
  domain: string,
  selectColumns: string,
  additionalFilters?: (query: any) => any
): Promise<{ data: T[]; isPartial: boolean }> {
  const lastSync = getLastSyncTime(domain);
  
  let query = (supabase.from(table as any) as any).select(selectColumns);
  
  if (additionalFilters) {
    query = additionalFilters(query);
  }

  // If we have a previous sync time, only fetch newer rows
  if (lastSync) {
    query = query.gte('updated_at', lastSync);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[SyncEngine] Selective sync failed for ${domain}:`, error);
    throw error;
  }

  // Record this sync
  recordSyncComplete(domain);

  return {
    data: (data || []) as T[],
    isPartial: !!lastSync,
  };
}

// ─── INITIALIZATION ─────────────────────────────────────────────────

let _initialized = false;

/**
 * Initialize the sync engine.
 * - Listens for connectivity changes to trigger background sync
 * - Sets up SW message handling
 */
export function initSyncEngine(): void {
  if (_initialized) return;
  _initialized = true;

  // Offlineköer hanteras av respektive queue-hook när anslutningen kommer tillbaka.
  onConnectivityChange(() => {});
}
