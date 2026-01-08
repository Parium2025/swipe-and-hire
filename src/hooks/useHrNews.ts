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

  // First, try to get RSS news from database (source_url is not null)
  const { data: rssNewsRaw, error: rssError } = await supabase
    .from('daily_hr_news')
    .select('*')
    .not('source_url', 'is', null)
    .not('published_at', 'is', null)
    .gte('published_at', thresholdIso)
    .order('published_at', { ascending: false, nullsFirst: false });

  const rssNews = (rssNewsRaw || []).filter((item) =>
    item.published_at ? isWithinLastHours(item.published_at, HOURS_WINDOW) : false,
  );

  // If we have RSS news, return them
  if (!rssError && rssNews.length > 0) {
    console.log('[HR News] Returning RSS news', { count: rssNews.length });
    return rssNews;
  }

  // No RSS news - check if we need to fetch fresh
  console.log('[HR News] No RSS news in window, fetching fresh...');

  try {
    const { data, error } = await supabase.functions.invoke('fetch-hr-news', {
      body: { force: true },
    });

    if (error) {
      console.error('[HR News] Backend function error:', error);
    }

    // Re-fetch RSS news after function call
    const { data: freshRssRaw } = await supabase
      .from('daily_hr_news')
      .select('*')
      .not('source_url', 'is', null)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    const freshRss = (freshRssRaw || []).filter((item) =>
      item.published_at ? isWithinLastHours(item.published_at, HOURS_WINDOW) : false,
    );

    if (freshRss.length > 0) {
      console.log('[HR News] Got fresh RSS news', { count: freshRss.length });
      return freshRss;
    }

    // Still no RSS news - use AI backup (source='Parium', source_url is null)
    console.log('[HR News] No RSS available, checking AI backup...');
    const { data: aiNews } = await supabase
      .from('daily_hr_news')
      .select('*')
      .eq('source', 'Parium')
      .is('source_url', null)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (aiNews && aiNews.length > 0) {
      console.log('[HR News] Using AI backup news', { count: aiNews.length });
      return aiNews as HrNewsItem[];
    }

    return [];
  } catch (err) {
    console.error('[HR News] Error invoking fetch-hr-news:', err);
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

