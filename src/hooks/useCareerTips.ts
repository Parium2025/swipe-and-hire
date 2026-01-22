import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

/**
 * BULLETPROOF CAREER TIPS FETCHER
 * 
 * PRINCIPLE: Backend is the ONLY gatekeeper
 * - Backend guarantees: all saved tips have valid published_at
 * - Backend guarantees: always tries to maintain 4 tips (RSS + AI fallback)
 * - Frontend: shows what's in DB, triggers refresh if < 4
 * 
 * NO FRONTEND FILTERING - trust the backend completely
 */
const fetchRecentCareerTips = async (): Promise<CareerTipItem[]> => {
  // Fetch ALL career tips - backend guarantees validity
  const { data: allTips, error } = await supabase
    .from('daily_career_tips')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4);

  // Happy path: we have tips (1-4 is fine, we show what's available)
  if (!error && allTips && allTips.length > 0) {
    console.log('[Career Tips] ✓ Got tips from DB', { 
      count: allTips.length,
      sources: allTips.map(t => t.source) 
    });
    return allTips;
  }

  // Not enough tips - trigger backend to fetch more
  const currentCount = allTips?.length || 0;
  console.log(`[Career Tips] Only ${currentCount} tips, triggering backend refresh...`);

  try {
    const { error: fnError } = await supabase.functions.invoke('fetch-career-tips', {
      body: { force: true },
    });

    if (fnError) {
      console.error('[Career Tips] Backend refresh error:', fnError);
    }

    // Re-fetch after backend processed
    const { data: refreshedTips } = await supabase
      .from('daily_career_tips')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(4);

    if (refreshedTips && refreshedTips.length > 0) {
      console.log('[Career Tips] ✓ After refresh:', { count: refreshedTips.length });
      return refreshedTips;
    }

    // Return what we originally had (fallback)
    console.log('[Career Tips] ⚠ Returning original data as fallback');
    return allTips || [];
  } catch (err) {
    console.error('[Career Tips] Fatal error:', err);
    return allTips || [];
  }
};

export const useCareerTips = () => {
  return useQuery({
    queryKey: ['career-tips'],
    queryFn: fetchRecentCareerTips,
    staleTime: 1000 * 60 * 5, // 5 minutes - check for new tips more often
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true, // Refetch when user comes back
    refetchOnMount: 'always', // Always check for fresh tips on mount
  });
};
