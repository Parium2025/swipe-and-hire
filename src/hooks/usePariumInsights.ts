import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { HrNewsItem } from '@/hooks/useHrNews';

const HOURS_WINDOW = 120; // 5 days

function isWithinLastHours(dateStr: string, hours: number): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= hours * 60 * 60 * 1000;
}

async function fetchPariumInsights(): Promise<HrNewsItem[]> {
  const thresholdIso = new Date(Date.now() - HOURS_WINDOW * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('daily_hr_news')
    .select('*')
    .eq('source', 'Parium')
    .not('published_at', 'is', null)
    .gte('published_at', thresholdIso)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(4);

  if (error) throw error;

  const rows = (data || []) as HrNewsItem[];
  return rows.filter((r) => (r.published_at ? isWithinLastHours(r.published_at, HOURS_WINDOW) : false));
}

export const usePariumInsights = () => {
  return useQuery({
    queryKey: ['parium-insights'],
    queryFn: fetchPariumInsights,
    staleTime: 0,
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
    retryDelay: 500,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
};
