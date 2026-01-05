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

  if (!cacheError && cachedNews && cachedNews.length >= 4) {
    return cachedNews;
  }

  // If no cached news, trigger the edge function to fetch fresh news
  try {
    const { data, error } = await supabase.functions.invoke('fetch-hr-news');
    
    if (error) {
      console.error('Failed to fetch HR news:', error);
      // Return cached news if available, even if incomplete
      return cachedNews || [];
    }

    return data?.news || [];
  } catch (err) {
    console.error('Error invoking fetch-hr-news:', err);
    return cachedNews || [];
  }
};

export const useHrNews = () => {
  return useQuery({
    queryKey: ['hr-news', new Date().toISOString().split('T')[0]],
    queryFn: fetchTodaysNews,
    staleTime: 1000 * 60 * 60, // 1 hour - don't refetch too often
    gcTime: 1000 * 60 * 60 * 24, // 24 hours cache
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
