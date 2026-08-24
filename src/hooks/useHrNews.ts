import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { safeSetItem } from '@/lib/safeStorage';

export interface HrNewsItem {
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
const CACHE_KEY = 'parium_hr_news_cache';
// How long a locally cached payload may be shown before we distrust it (freeze protection)
const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000;
// How old the newest article may be before we ask the backend for a refresh (in the background)
const STALE_ARTICLE_AGE_MS = 72 * 60 * 60 * 1000;

// Cron runs at 06, 11, 18, 23 UTC — calculate ms until next slot
function msUntilNextCronSlot(): number {
  const now = new Date();
  const slots = [6, 11, 18, 23];
  const currentHour = now.getUTCHours();
  const currentMinutes = now.getUTCMinutes();

  let nextSlotHour = slots.find(h => h > currentHour || (h === currentHour && currentMinutes < 5));
  if (nextSlotHour == null) {
    nextSlotHour = slots[0];
  }

  const next = new Date(now);
  next.setUTCHours(nextSlotHour, 5, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  return next.getTime() - now.getTime();
}

interface CachedData {
  items: HrNewsItem[];
  timestamp: number;
}

function readCache(): HrNewsItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.items)) return null;
    // Safety net: never show a cache that can't be refreshed (e.g. backend error)
    if (!cached.timestamp || Date.now() - cached.timestamp > MAX_CACHE_AGE_MS) {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    return cached.items;
  } catch {
    return null;
  }
}


function writeCache(items: HrNewsItem[]): void {
  try {
    const cached: CachedData = { items, timestamp: Date.now() };
    safeSetItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

function hasStaleVisibleNews(items: HrNewsItem[] | null | undefined): boolean {
  if (!items?.length) return true;
  const newest = items.reduce((latest, item) => {
    if (!item.published_at) return latest;
    const time = new Date(item.published_at).getTime();
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
  return newest === 0 || Date.now() - newest > STALE_ARTICLE_AGE_MS;
}

// Per-enhet cooldown: en enskild klient får aldrig be backend om en ny körning
// oftare än så här. Skyddar mot att miljoner flikar triggar samma jobb samtidigt
// (backend har dessutom ett eget körningslås).
const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;
const REFRESH_KEY = 'parium_hr_news_last_refresh';

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
 * BULLETPROOF NEWS FETCHER
 *
 * PRINCIPLE: never hide content we already have.
 * - If the database returns articles, we always show them.
 * - If they look old, we ask the backend for fresh ones in the background —
 *   silently, without ever emptying the card while it works.
 */
const fetchRecentNews = async (): Promise<HrNewsItem[]> => {
  const { data: allNews, error } = await supabase
    .from('daily_hr_news')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4);

  if (error) {
    console.error('[HR News] Read error:', error.message);
  }

  // We have content — always show it, refresh in the background if it's old
  if (allNews && allNews.length > 0) {
    writeCache(allNews);

    if (hasStaleVisibleNews(allNews) && mayRequestRefresh()) {
      void supabase.functions
        .invoke('fetch-hr-news', { body: {} })
        .catch(() => { /* background refresh, never blocks the UI */ });
    }

    return allNews;
  }

  // Truly empty: try once to have the backend populate the feed
  try {
    if (mayRequestRefresh()) {
      await supabase.functions.invoke('fetch-hr-news', { body: {} });
    }


    const { data: refreshedNews } = await supabase
      .from('daily_hr_news')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (refreshedNews && refreshedNews.length > 0) {
      writeCache(refreshedNews);
      return refreshedNews;
    }
  } catch {
    /* offline or edge function unreachable — fall through to cache */
  }

  // Last resort: whatever is still cached locally
  return readCache() ?? [];
};

export const useHrNews = () => {
  // Ingen realtidskanal här: flödet uppdateras bara 4 ggr/dygn av cron, och en
  // öppen realtidsprenumeration per besökare skalar dåligt vid miljontals
  // användare. staleTime är synkad mot cron-slotarna + refetch vid fokus.


  return useQuery({
    queryKey: ['hr-news'],
    queryFn: fetchRecentNews,
    staleTime: msUntilNextCronSlot(),
    gcTime: Infinity,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Instant load from localStorage cache
    initialData: () => readCache() ?? undefined,
    initialDataUpdatedAt: () => {
      const cached = readCache();
      return cached ? 0 : undefined;
    },
  });
};
