import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

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

// LocalStorage cache for instant load - WITH daily invalidation
const CACHE_KEY = 'parium_hr_news_cache';

interface CachedData {
  items: HrNewsItem[];
  timestamp: number;
  dateKey: string; // YYYY-MM-DD to invalidate on day change
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function readCache(): { items: HrNewsItem[]; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    
    // Invalidate cache if it's from a different day
    if (cached.dateKey !== getTodayKey()) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return { items: cached.items, timestamp: cached.timestamp };
  } catch {
    return null;
  }
}

function writeCache(items: HrNewsItem[]): void {
  try {
    const cached: CachedData = { 
      items, 
      timestamp: Date.now(),
      dateKey: getTodayKey()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
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

  // Happy path: we have articles (1-4 is fine, we show what's available)
  if (!error && allNews && allNews.length > 0) {
    // Update cache with fresh data
    writeCache(allNews);
    return allNews;
  }

  // Not enough articles - trigger backend to fetch more
  const currentCount = allNews?.length || 0;
  console.log(`[HR News] Only ${currentCount} articles, triggering backend refresh...`);

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
    staleTime: 1000 * 60 * 5, // 5 minutes - check for new articles
    gcTime: 1000 * 60 * 60, // 1 hour in memory
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Instant load from localStorage cache
    initialData: () => {
      const cached = readCache();
      return cached?.items ?? undefined;
    },
    initialDataUpdatedAt: () => {
      const cached = readCache();
      // Use actual cache timestamp for proper staleness calculation
      return cached?.timestamp ?? undefined;
    },
  });
};
