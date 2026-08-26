import { supabase } from '@/integrations/supabase/client';
import { safeSetItem } from '@/lib/safeStorage';

/**
 * Förvärmning av supportsidan.
 *
 * Supportärenden hämtades tidigare först när /support monterades, vilket gav
 * "Laddar ärenden..." vid varje kallstart. Här fylls en localStorage-cache som
 * sidan läser synkront vid montering — samma query, samma format, ingen
 * funktionell skillnad.
 */

const SUPPORT_TICKETS_CACHE_PREFIX = 'parium-support-tickets:';
const PREWARM_TTL_MS = 60_000;

export type CachedSupportTicket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  [key: string]: unknown;
};

type CacheShape = {
  userId: string;
  timestamp: number;
  tickets: CachedSupportTicket[];
};

const cacheKey = (userId: string) => `${SUPPORT_TICKETS_CACHE_PREFIX}${userId}`;

/** Max-ålder på cachen. Äldre data kastas — hellre skelett än gammalt innehåll. */
const CACHE_TTL_MS = 30 * 60 * 1000;

export function readCachedSupportTickets(userId?: string | null): CachedSupportTicket[] | null {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.tickets)) return null;
    if (!Number.isFinite(parsed.timestamp) || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(userId));
      return null;
    }

    return parsed.tickets;
  } catch {
    return null;
  }
}

export function writeCachedSupportTickets(userId: string, tickets: CachedSupportTicket[]): void {
  safeSetItem(
    cacheKey(userId),
    JSON.stringify({ userId, timestamp: Date.now(), tickets } satisfies CacheShape),
  );
}

let inFlight: Promise<void> | null = null;
let lastUserId: string | null = null;
let lastRunAt = 0;

export function prewarmSupportTickets(userId?: string | null): void {
  if (!userId) return;

  const now = Date.now();
  if (inFlight && lastUserId === userId) return;
  if (lastUserId === userId && now - lastRunAt < PREWARM_TTL_MS) return;

  lastUserId = userId;
  lastRunAt = now;

  inFlight = (async () => {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return;
    writeCachedSupportTickets(userId, data as unknown as CachedSupportTicket[]);
  })()
    .catch(() => {
      // Bäst-möjliga-insats: sidan hämtar själv vid behov.
    })
    .finally(() => {
      inFlight = null;
    });
}
