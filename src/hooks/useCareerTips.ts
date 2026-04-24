import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

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

// LocalStorage cache for instant load - syncs based on cron schedule
const CACHE_KEY = 'parium_career_tips_cache';

// Cron runs at 06, 11, 18, 23 UTC — calculate ms until next slot
function msUntilNextCronSlot(): number {
  const now = new Date();
  const slots = [6, 11, 18, 23];
  const currentHour = now.getUTCHours();
  const currentMinutes = now.getUTCMinutes();

  // Find next slot
  let nextSlotHour = slots.find(h => h > currentHour || (h === currentHour && currentMinutes < 5));
  if (nextSlotHour == null) {
    // Wrap to first slot tomorrow
    nextSlotHour = slots[0];
  }

  const next = new Date(now);
  next.setUTCHours(nextSlotHour, 5, 0, 0); // 5 min buffer for edge fn to finish
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  return next.getTime() - now.getTime();
}

interface CachedData {
  items: CareerTipItem[];
  timestamp: number;
}

function readCache(): CareerTipItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.items)) {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    return cached.items;
  } catch {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function writeCache(items: CareerTipItem[]): void {
  try {
    const cached: CachedData = { items, timestamp: Date.now() };
    safeSetItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
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
    // Update cache with fresh data
    writeCache(allTips);
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
      writeCache(refreshedTips);
      return refreshedTips;
    }

    // Return what we originally had (fallback)
    return allTips || [];
  } catch (err) {
    console.error('[Career Tips] Fatal error:', err);
    return allTips || [];
  }
};

export const useCareerTips = () => {
  const queryClient = useQueryClient();

  // Real-time subscription for instant updates when new tips are added
  useEffect(() => {
    const channel = supabase
      .channel('career-tips-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_career_tips',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['career-tips'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['career-tips'],
    queryFn: fetchRecentCareerTips,
    staleTime: msUntilNextCronSlot(), // Giltig tills nästa cron-körning
    gcTime: Infinity,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true, // Kolla vid fokus — men bara om staleTime passerat
    refetchOnMount: true, // Refetch vid mount om stale
    // Instant load from localStorage cache
    initialData: () => readCache() ?? undefined,
    initialDataUpdatedAt: () => {
      const cached = readCache();
      // Return 0 so initialData is always stale on first load → triggers one background refetch
      return cached ? 0 : undefined;
    },
  });
};
