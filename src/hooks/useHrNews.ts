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

  // Happy path: we have 4 valid articles
  if (!error && allNews && allNews.length >= 4) {
    console.log('[HR News] ✓ Got 4 articles from DB', { 
      sources: allNews.map(n => n.source) 
    });
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
      console.log('[HR News] ✓ After refresh:', { count: refreshedNews.length });
      return refreshedNews;
    }

    // Return what we originally had (fallback)
    console.log('[HR News] ⚠ Returning original data as fallback');
    return allNews || [];
  } catch (err) {
    console.error('[HR News] Fatal error:', err);
    return allNews || [];
  }
};

export const useHrNews = () => {
  return useQuery({
    queryKey: ['hr-news', new Date().toISOString().split('T')[0]],
    queryFn: fetchRecentNews,
    staleTime: 1000 * 60 * 15, // 15 minutes (shorter for fresher news)
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
};
