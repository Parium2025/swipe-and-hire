import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

const HOURS_WINDOW = 120; // 5 days (Monday-Friday)

function isWithinLastHours(dateStr: string, hours: number): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= hours * 60 * 60 * 1000;
}

const fetchRecentNews = async (): Promise<HrNewsItem[]> => {
  const thresholdIso = new Date(Date.now() - HOURS_WINDOW * 60 * 60 * 1000).toISOString();

  // First, try to get cached news from database (last 48h, not "today")
  const { data: cachedNewsRaw, error: cacheError } = await supabase
    .from('daily_hr_news')
    .select('*')
    .not('published_at', 'is', null)
    .gte('published_at', thresholdIso)
    .order('published_at', { ascending: false, nullsFirst: false });

  const cachedNews = (cachedNewsRaw || []).filter((item) =>
    item.published_at ? isWithinLastHours(item.published_at, HOURS_WINDOW) : false,
  );

  const hasRealSources = cachedNews.some((item) => item.source_url);
  const cachedPreferred = hasRealSources ? cachedNews.filter((item) => !!item.source_url) : cachedNews;

  // If we have cached news, prefer real sources when available
  if (!cacheError && cachedPreferred.length > 0) {
    console.log('[HR News] Returning cached news (48h window)', {
      count: cachedPreferred.length,
      thresholdIso,
    });
    return cachedPreferred;
  }

  // Otherwise, fetch fresh
  const needsRefresh = !cachedNewsRaw || cachedNewsRaw.length === 0 || !hasRealSources;
  console.log('[HR News] Fetching fresh news via backend function...', { needsRefresh, hasRealSources });

  try {
    const { data, error } = await supabase.functions.invoke('fetch-hr-news', {
      body: { force: needsRefresh },
    });

    if (error) {
      console.error('[HR News] Backend function error:', error);
      if (!cacheError && cachedPreferred.length > 0) return cachedPreferred;
      return [];
    }

    const fresh = (data?.news || []) as HrNewsItem[];
    const freshFiltered = fresh
      .filter((item) => item.published_at && isWithinLastHours(item.published_at, HOURS_WINDOW))
      .sort((a, b) => {
        const at = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bt - at;
      });

    const hasFreshRealSources = freshFiltered.some((item) => item.source_url);
    const freshPreferred = hasFreshRealSources
      ? freshFiltered.filter((item) => !!item.source_url)
      : freshFiltered;

    console.log('[HR News] Got items (48h filtered)', {
      total: fresh.length,
      kept: freshPreferred.length,
      source: data?.source,
    });

    if (freshPreferred.length > 0) return freshPreferred;
    if (!cacheError && cachedPreferred.length > 0) return cachedPreferred;
    return [];
  } catch (err) {
    console.error('[HR News] Error invoking fetch-hr-news:', err);
    if (!cacheError && cachedPreferred.length > 0) return cachedPreferred;
    return [];
  }
};

export const useHrNews = () => {
  return useQuery({
    queryKey: ['hr-news', new Date().toISOString().split('T')[0]],
    queryFn: fetchRecentNews,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
};

