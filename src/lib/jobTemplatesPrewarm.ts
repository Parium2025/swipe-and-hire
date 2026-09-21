import { supabase } from '@/integrations/supabase/client';
import { safeSetItem } from '@/lib/safeStorage';

/**
 * Förvärmning av jobbmallar (/templates).
 *
 * Mallsidan hämtade tidigare sin lista först vid montering, vilket gav skelett
 * vid varje kallstart. Här fylls en localStorage-cache som sidan läser
 * synkront vid montering — samma query, samma format, ingen funktionell
 * skillnad. Sidan hämtar ändå om i bakgrunden (stale-while-revalidate).
 */

const CACHE_PREFIX = 'parium-job-templates:';
const PREWARM_THROTTLE_MS = 60_000;
/** Max-ålder på cachen. Äldre data kastas — hellre skelett än gammalt innehåll. */
const CACHE_TTL_MS = 30 * 60 * 1000;

export type CachedJobTemplate = {
  id: string;
  name: string;
  [key: string]: unknown;
};

type CacheShape = {
  userId: string;
  timestamp: number;
  templates: CachedJobTemplate[];
};

const cacheKey = (userId: string) => `${CACHE_PREFIX}${userId}`;

export function readCachedJobTemplates(userId?: string | null): CachedJobTemplate[] | null {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.templates)) return null;
    if (!Number.isFinite(parsed.timestamp) || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(userId));
      return null;
    }

    return parsed.templates;
  } catch {
    return null;
  }
}

export function writeCachedJobTemplates(userId: string, templates: CachedJobTemplate[]): void {
  safeSetItem(
    cacheKey(userId),
    JSON.stringify({ userId, timestamp: Date.now(), templates } satisfies CacheShape),
  );
}

async function fetchJobTemplates(userId: string) {
  const { data, error } = await supabase
    .from('job_templates')
    .select('*')
    .eq('employer_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CachedJobTemplate[];
}

let inFlight: Promise<void> | null = null;
let lastUserId: string | null = null;
let lastRunAt = 0;

export function prewarmJobTemplates(userId?: string | null): void {
  if (!userId) return;

  const now = Date.now();
  if (inFlight && lastUserId === userId) return;
  if (lastUserId === userId && now - lastRunAt < PREWARM_THROTTLE_MS) return;

  lastUserId = userId;
  lastRunAt = now;

  inFlight = (async () => {
    const templates = await fetchJobTemplates(userId);
    writeCachedJobTemplates(userId, templates);
  })()
    .catch(() => {
      // Bäst-möjliga-insats: sidan hämtar själv vid behov.
    })
    .finally(() => {
      inFlight = null;
    });
}
