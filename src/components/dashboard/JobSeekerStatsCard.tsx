import { memo, useMemo, useEffect } from 'react';
import { safeSetItem } from '@/lib/safeStorage';
import { Send, Calendar, Heart, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatsCarousel } from './StatsCarousel';
import type { StatData } from './StatsCarousel';

const STATS_CACHE_KEY = 'parium-jobseeker-stats';

const readCachedStats = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const writeCachedStats = (key: string, value: number) => {
  try {
    const current = readCachedStats();
    current[key] = value;
    safeSetItem(STATS_CACHE_KEY, JSON.stringify(current));
  } catch {}
};

interface JobSeekerStatsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

export const JobSeekerStatsCard = memo(({ isPaused, setIsPaused }: JobSeekerStatsCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cachedStats = useMemo(() => readCachedStats(), []);

  const { data: dashStats, isSuccess } = useQuery({
    queryKey: ['jobseeker-dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { applications: 0, interviews: 0, saved_jobs: 0, unread_messages: 0 };
      const { data, error } = await supabase.rpc('get_jobseeker_dashboard_stats', {
        p_user_id: user.id,
      });
      if (error) return { applications: 0, interviews: 0, saved_jobs: 0, unread_messages: 0 };
      const stats = data as { applications: number; interviews: number; saved_jobs: number; unread_messages: number };
      writeCachedStats('applications', stats.applications);
      writeCachedStats('interviews', stats.interviews);
      writeCachedStats('saved', stats.saved_jobs);
      writeCachedStats('messages', stats.unread_messages);
      return stats;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
  });

  const applicationsCount = dashStats?.applications ?? cachedStats['applications'] ?? 0;
  const interviewsCount = dashStats?.interviews ?? cachedStats['interviews'] ?? 0;
  const savedJobsCount = dashStats?.saved_jobs ?? cachedStats['saved'] ?? 0;
  const unreadMessagesCount = dashStats?.unread_messages ?? cachedStats['messages'] ?? 0;

  // Single consolidated realtime channel
  useEffect(() => {
    if (!user?.id) return;
    const invalidateStats = () => {
      queryClient.invalidateQueries({ queryKey: ['jobseeker-dashboard-stats'] });
    };
    const statsChannel = supabase
      .channel(`jobseeker-stats-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${user.id}` },
        invalidateStats
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `applicant_id=eq.${user.id}` },
        invalidateStats
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_jobs', filter: `user_id=eq.${user.id}` },
        invalidateStats
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        invalidateStats
      )
      .subscribe();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidateStats();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      supabase.removeChannel(statsChannel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, queryClient]);

  const statsArray: StatData[] = useMemo(() => [
    { icon: Send, label: 'Skickade ansökningar', value: applicationsCount, description: 'Dina jobbansökningar', link: '/my-applications', emptyHint: 'Börja söka jobb!' },
    { icon: Calendar, label: 'Bokade intervjuer', value: interviewsCount, description: 'Kommande intervjuer', emptyHint: 'Inga bokade än' },
    { icon: Heart, label: 'Sparade jobb', value: savedJobsCount, description: 'Jobb du sparat', link: '/saved-jobs', emptyHint: 'Spara jobb du gillar' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages', emptyHint: 'Inga olästa' },
  ], [applicationsCount, interviewsCount, savedJobsCount, unreadMessagesCount]);

  return (
    <StatsCarousel
      stats={statsArray}
      isPaused={isPaused}
      setIsPaused={setIsPaused}
      dataReady={isSuccess}
      hasCachedData={Object.keys(cachedStats).length > 0}
    />
  );
});

JobSeekerStatsCard.displayName = 'JobSeekerStatsCard';
