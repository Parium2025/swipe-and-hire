import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface CareerTipItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  category: string;
  icon_name: string | null;
  gradient: string | null;
  news_date: string;
  created_at: string;
  order_index: number;
  published_at: string | null;
  is_translated?: boolean;
}

// LocalStorage cache for instant load - syncs based on cron schedule
const CACHE_KEY = 'parium_career_tips_cache';
// How long a locally cached payload may be shown before we distrust it (freeze protection)
const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000;
// How old the newest tip may be before we refresh in the background
const STALE_TIP_AGE_MS = 72 * 60 * 60 * 1000;

// Cron runs at 06, 11, 18, 23 UTC — calculate ms until next slot
function msUntilNextCronSlot(): number {
  const now = new Date();
  const slots = [6, 11, 18, 23];
  const currentHour = now.getUTCHours();
  const currentMinutes = now.getUTCMinutes();

  // Find next slot
  let nextSlotHour = slots.find(h => h > currentHour || (h === currentHour && currentMinutes < 5));
  if (nextSlotHour == null) {
    // Wrap to first slot tomorrow
    nextSlotHour = slots[0];
  }

  const next = new Date(now);
  next.setUTCHours(nextSlotHour, 5, 0, 0); // 5 min buffer for edge fn to finish
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  return next.getTime() - now.getTime();
}

interface CachedData {
  items: CareerTipItem[];
  timestamp: number;
}

function readCache(): CareerTipItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.items)) {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    // Freeze protection: distrust a cache that hasn't been refreshed in a long time
    if (!cached.timestamp || Date.now() - cached.timestamp > MAX_CACHE_AGE_MS) {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    return cached.items;
  } catch {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function writeCache(items: CareerTipItem[]): void {
  try {
    const cached: CachedData = { items, timestamp: Date.now() };
    safeSetItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

function hasStaleVisibleTips(items: CareerTipItem[] | null | undefined): boolean {
  if (!items?.length) return true;
  const newest = items.reduce((latest, item) => {
    if (!item.published_at) return latest;
    const time = new Date(item.published_at).getTime();
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
  return newest === 0 || Date.now() - newest > STALE_TIP_AGE_MS;
}

// Per-enhet cooldown mot att många klienter triggar samma bakgrundsjobb.
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;
const REFRESH_KEY = 'parium_career_tips_last_refresh';

function mayRequestRefresh(): boolean {
  try {
    const last = Number(localStorage.getItem(REFRESH_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < REFRESH_COOLDOWN_MS) return false;
    safeSetItem(REFRESH_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — allow the call */
  }
  return true;
}

/**
 * BULLETPROOF CAREER TIPS FETCHER
 *
 * PRINCIPLE: never hide content we already have.
 * - If the database returns tips, we always show them.
 * - If they look old, the backend is asked for fresh ones in the background,
 *   without ever emptying the card while it works.
 */
const fetchRecentCareerTips = async (): Promise<CareerTipItem[]> => {
  const { data: allTips, error } = await supabase
    .from('daily_career_tips')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4);

  if (error) {
    console.error('[Career Tips] Read error:', error.message);
  }

  if (allTips && allTips.length > 0) {
    writeCache(allTips);

    if (hasStaleVisibleTips(allTips) && mayRequestRefresh()) {
      void supabase.functions
        .invoke('fetch-career-tips', { body: {} })
        .catch(() => { /* background refresh, never blocks the UI */ });
    }

    return allTips;
  }

  try {
    if (mayRequestRefresh()) {
      await supabase.functions.invoke('fetch-career-tips', { body: {} });
    }


    const { data: refreshedTips } = await supabase
      .from('daily_career_tips')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (refreshedTips && refreshedTips.length > 0) {
      writeCache(refreshedTips);
      return refreshedTips;
    }
  } catch {
    /* offline or edge function unreachable — fall through to cache */
  }

  return readCache() ?? [];
};

export const useCareerTips = () => {
  // Ingen realtidskanal: innehållet byts bara 4 ggr/dygn av cron. staleTime är
  // synkad mot cron-slotarna, vilket skalar utan en öppen socket per besökare.


  return useQuery({
    queryKey: ['career-tips'],
    queryFn: fetchRecentCareerTips,
    staleTime: msUntilNextCronSlot(), // Giltig tills nästa cron-körning
    gcTime: Infinity,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true, // Kolla vid fokus — men bara om staleTime passerat
    refetchOnMount: true, // Refetch vid mount om stale
    // Instant load from localStorage cache
    initialData: () => readCache() ?? undefined,
    initialDataUpdatedAt: () => {
      const cached = readCache();
      // Return 0 so initialData is always stale on first load → triggers one background refetch
      return cached ? 0 : undefined;
    },
  });
};
