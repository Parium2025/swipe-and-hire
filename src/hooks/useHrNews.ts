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
    if (!cached.timestamp || Date.now() - cached.timestamp > MAX_VISIBLE_NEWS_AGE_MS) {
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
  return newest === 0 || Date.now() - newest > MAX_VISIBLE_NEWS_AGE_MS;
}

/**
 * BULLETPROOF NEWS FETCHER
 * 
 * PRINCIPLE: Backend is the ONLY gatekeeper
 * - Backend guarantees: all saved articles have valid published_at
 * - Backend guarantees: always tries to maintain 4 articles (RSS + AI fallback)
 * - Frontend: shows what's in DB, triggers refresh if < 4
 * 
 * NO FRONTEND FILTERING - trust the backend completely
 */
const fetchRecentNews = async (): Promise<HrNewsItem[]> => {
  // Fetch ALL news (RSS + any AI fallback) - backend guarantees validity
  const { data: allNews, error } = await supabase
    .from('daily_hr_news')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4);

  // Happy path: we have fresh articles (1-4 is fine, we show what's available)
  if (!error && allNews && allNews.length > 0 && !hasStaleVisibleNews(allNews)) {
    // Update cache with fresh data
    writeCache(allNews);
    return allNews;
  }

  // Not enough/fresh articles - trigger backend to fetch more
  const currentCount = allNews?.length || 0;
  console.log(`[HR News] ${currentCount} stale/missing articles, triggering backend refresh...`);

  try {
    const { error: fnError } = await supabase.functions.invoke('fetch-hr-news', {
      body: { force: true },
    });

    if (fnError) {
      console.error('[HR News] Backend refresh error:', fnError);
    }

    // Re-fetch after backend processed
    const { data: refreshedNews } = await supabase
      .from('daily_hr_news')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (refreshedNews && refreshedNews.length > 0) {
      writeCache(refreshedNews);
      return refreshedNews;
    }

    // Return what we originally had (fallback)
    return allNews || [];
  } catch (err) {
    console.error('[HR News] Fatal error:', err);
    return allNews || [];
  }
};

export const useHrNews = () => {
  const queryClient = useQueryClient();

  // Real-time subscription for instant updates when new articles are added
  useEffect(() => {
    const channel = supabase
      .channel('hr-news-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_hr_news',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['hr-news'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
