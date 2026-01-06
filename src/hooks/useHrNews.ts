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
  order_index: number;
}

const fetchTodaysNews = async (): Promise<HrNewsItem[]> => {
  const today = new Date().toISOString().split('T')[0];
  
  // First, try to get cached news from database
  const { data: cachedNews, error: cacheError } = await supabase
    .from('daily_hr_news')
    .select('*')
    .eq('news_date', today)
    .order('order_index');

  const hasRealSources = !!cachedNews?.some((item) => item.source_url);
  
  // If we have cached news with real sources, return it
  if (!cacheError && cachedNews && cachedNews.length > 0 && hasRealSources) {
    console.log('[HR News] Returning cached news with real sources');
    return cachedNews;
  }

  // Otherwise, fetch fresh
  const needsRefresh = !cachedNews || cachedNews.length === 0 || !hasRealSources;
  console.log('[HR News] Fetching fresh news via edge function...', { needsRefresh, hasRealSources });
  
  try {
    const { data, error } = await supabase.functions.invoke('fetch-hr-news', {
      body: { force: needsRefresh },
    });
    
    if (error) {
      console.error('[HR News] Edge function error:', error);
      if (cachedNews && cachedNews.length > 0 && hasRealSources) {
        return cachedNews;
      }
      return [];
    }

    // The edge function returns { news: [...], cached: boolean, source: string }
    if (data?.news && data.news.length > 0) {
      console.log(`[HR News] Got ${data.news.length} items (source: ${data.source})`);
      return data.news;
    }

    if (cachedNews && cachedNews.length > 0 && hasRealSources) {
      return cachedNews;
    }

    return [];
  } catch (err) {
    console.error('[HR News] Error invoking fetch-hr-news:', err);

    if (cachedNews && cachedNews.length > 0 && hasRealSources) {
      return cachedNews;
    }

    return [];
  }
};

export const useHrNews = () => {
  return useQuery({
    queryKey: ['hr-news', new Date().toISOString().split('T')[0]],
    queryFn: fetchTodaysNews,
    staleTime: 1000 * 60 * 30, // 30 minutes - reasonable refresh
    gcTime: 1000 * 60 * 60 * 2, // 2 hours cache
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
};
