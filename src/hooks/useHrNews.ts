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
 * Fetch news from database - TRUST THE BACKEND
 * Backend is the gatekeeper: only valid articles with published_at are saved
 * Frontend shows whatever is in the database without additional filtering
 */
const fetchRecentNews = async (): Promise<HrNewsItem[]> => {
  // First, try to get RSS news from database (source_url is not null)
  // Backend guarantees all saved articles have valid published_at
  const { data: rssNews, error: rssError } = await supabase
    .from('daily_hr_news')
    .select('*')
    .not('source_url', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4);

  // If we have RSS news, return them (no additional filtering!)
  if (!rssError && rssNews && rssNews.length >= 4) {
    console.log('[HR News] Returning RSS news from DB', { count: rssNews.length });
    return rssNews;
  }

  // Not enough RSS news - trigger backend refresh
  console.log('[HR News] Not enough RSS news, triggering refresh...', { 
    currentCount: rssNews?.length || 0 
  });

  try {
    const { error } = await supabase.functions.invoke('fetch-hr-news', {
      body: { force: true },
    });

    if (error) {
      console.error('[HR News] Backend function error:', error);
    }

    // Re-fetch from database after backend refresh
    const { data: freshRss } = await supabase
      .from('daily_hr_news')
      .select('*')
      .not('source_url', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (freshRss && freshRss.length > 0) {
      console.log('[HR News] Got fresh RSS news', { count: freshRss.length });
      return freshRss;
    }

    // Still no RSS news - check for AI backup
    console.log('[HR News] No RSS available, checking AI backup...');
    const { data: aiNews } = await supabase
      .from('daily_hr_news')
      .select('*')
      .eq('source', 'Parium')
      .is('source_url', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (aiNews && aiNews.length > 0) {
      console.log('[HR News] Using AI backup news', { count: aiNews.length });
      return aiNews as HrNewsItem[];
    }

    // Return whatever RSS we have, even if less than 4
    if (rssNews && rssNews.length > 0) {
      return rssNews;
    }

    return [];
  } catch (err) {
    console.error('[HR News] Error invoking fetch-hr-news:', err);
    // Return whatever we have from initial query
    return rssNews || [];
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
