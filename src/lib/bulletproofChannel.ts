import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * 🚀 BULLETPROOF REALTIME CHANNEL
 *
 * Wrapper runt supabase.channel() med:
 * - Auto-reconnect vid CHANNEL_ERROR / TIMED_OUT / CLOSED
 * - Exponential backoff (1s → 2s → 4s → 8s → max 30s)
 * - Återgår till 1s när anslutningen är stabil i 60s
 * - Cleanup-säker: returnerar funktion som stänger ner allt korrekt
 *
 * VARFÖR: Vid 1 000+ samtidiga användare kan WebSocket-anslutningar tappas
 * pga nätverk, server-restarts eller mobil-bakgrund. Utan reconnect ser
 * användaren stale data tills sidan laddas om. Med reconnect: osynligt.
 */

export interface ChannelSubscription {
  /** Tabellen att lyssna på */
  table: string;
  /** Schema (default 'public') */
  schema?: string;
  /** Postgres event type */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** Filter, t.ex. `employer_id=eq.${userId}` */
  filter?: string;
  /** Callback vid event */
  callback: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void;
}

export interface RealtimeChannelOptions {
  /** Unikt kanalnamn (ex: `employer-jobs-${userId}`) */
  channelName: string;
  /** En eller flera prenumerationer (delar samma WebSocket-kanal) */
  subscriptions: ChannelSubscription[];
  /** Max antal återanslutningar (default obegränsat) */
  maxRetries?: number;
}

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const STABILITY_THRESHOLD_MS = 60_000;

export function createBulletproofChannel(options: RealtimeChannelOptions): () => void {
  const { channelName, subscriptions, maxRetries = Infinity } = options;

  let channel: RealtimeChannel | null = null;
  let retryCount = 0;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stabilityTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const resetBackoffAfterStability = () => {
    if (stabilityTimer) clearTimeout(stabilityTimer);
    stabilityTimer = setTimeout(() => {
      backoff = INITIAL_BACKOFF_MS;
      retryCount = 0;
    }, STABILITY_THRESHOLD_MS);
  };

  const scheduleReconnect = () => {
    if (cancelled || retryCount >= maxRetries) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);

    const delay = Math.min(backoff, MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(() => {
      retryCount += 1;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      connect();
    }, delay);
  };

  const teardownCurrent = () => {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      channel = null;
    }
  };

  const connect = () => {
    if (cancelled) return;
    teardownCurrent();

    let ch = supabase.channel(channelName);

    for (const sub of subscriptions) {
      ch = ch.on(
        'postgres_changes' as any,
        {
          event: sub.event ?? '*',
          schema: sub.schema ?? 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        sub.callback,
      );
    }

    ch.subscribe((status) => {
      if (cancelled) return;

      if (status === 'SUBSCRIBED') {
        // Anslutning OK — starta stabilitetstimer som nollställer backoff
        resetBackoffAfterStability();
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (stabilityTimer) {
          clearTimeout(stabilityTimer);
          stabilityTimer = null;
        }
        scheduleReconnect();
      }
    });

    channel = ch;
  };

  connect();

  // Cleanup-funktion
  return () => {
    cancelled = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (stabilityTimer) clearTimeout(stabilityTimer);
    teardownCurrent();
  };
}
