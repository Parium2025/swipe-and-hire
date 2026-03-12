import { memo, useMemo, useEffect } from 'react';
import { Briefcase, Heart, UserPlus, MessageSquare } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isJobExpiredCheck } from '@/lib/date';
import { StatsCarousel } from './StatsCarousel';
import type { StatData } from './StatsCarousel';

const EMPLOYER_STATS_CACHE_KEY = 'parium-employer-stats';

const readEmployerCachedStats = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(EMPLOYER_STATS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const writeEmployerCachedStat = (key: string, value: number) => {
  try {
    const current = readEmployerCachedStats();
    current[key] = value;
    localStorage.setItem(EMPLOYER_STATS_CACHE_KEY, JSON.stringify(current));
  } catch {}
};

interface EmployerStatsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

export const EmployerStatsCard = memo(({ isPaused, setIsPaused }: EmployerStatsCardProps) => {
  const { jobs, isLoading: jobsLoading } = useJobsData({ scope: 'personal' });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cachedStats = useMemo(() => readEmployerCachedStats(), []);

  const activeJobIds = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at))
      .map(j => j.id);
  }, [jobs]);

  const { data: dashStats, isSuccess } = useQuery({
    queryKey: ['employer-dashboard-stats', user?.id, activeJobIds],
    queryFn: async () => {
      if (!user?.id || activeJobIds.length === 0) return { new_applications: 0, saved_favorites: 0, unread_messages: 0 };
      const { data, error } = await supabase.rpc('get_employer_dashboard_stats', {
        p_user_id: user.id,
        p_active_job_ids: activeJobIds,
      });
      if (error) return { new_applications: 0, saved_favorites: 0, unread_messages: 0 };
      const stats = data as { new_applications: number; saved_favorites: number; unread_messages: number };
      writeEmployerCachedStat('new_applications', stats.new_applications);
      writeEmployerCachedStat('saved_favorites', stats.saved_favorites);
      writeEmployerCachedStat('unread_messages', stats.unread_messages);
      return stats;
    },
    enabled: !!user?.id && activeJobIds.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
  });

  const newApplicationsCount = dashStats?.new_applications ?? cachedStats['new_applications'] ?? 0;
  const savedFavoritesCount = dashStats?.saved_favorites ?? cachedStats['saved_favorites'] ?? 0;
  const unreadMessagesCount = dashStats?.unread_messages ?? cachedStats['unread_messages'] ?? 0;

  useEffect(() => {
    if (!user?.id) return;
    const invalidateStats = () => {
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard-stats'] });
    };
    const msgChannel = supabase
      .channel(`employer-conv-messages-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
        invalidateStats
      )
      .subscribe();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidateStats();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const pollInterval = setInterval(invalidateStats, 60000);
    return () => {
      supabase.removeChannel(msgChannel);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollInterval);
    };
  }, [user?.id, queryClient]);

  const activeJobsCount = activeJobIds.length;
  useEffect(() => {
    if (!jobsLoading && activeJobsCount > 0) {
      writeEmployerCachedStat('active_jobs', activeJobsCount);
    }
  }, [activeJobsCount, jobsLoading]);

  const displayActiveJobs = jobsLoading ? (cachedStats['active_jobs'] ?? 0) : activeJobsCount;

  const statsArray: StatData[] = useMemo(() => [
    { icon: Briefcase, label: 'Aktiva annonser', value: displayActiveJobs, description: 'Mina aktiva jobbannonser', link: '/my-jobs?sort=active-first', emptyHint: 'Skapa din första annons' },
    { icon: UserPlus, label: 'Nya ansökningar', value: newApplicationsCount, description: 'Ansökningar du inte sett ännu', link: '/my-jobs?sort=active-first', emptyHint: 'Inga nya just nu' },
    { icon: Heart, label: 'Sparade favoriter', value: savedFavoritesCount, description: 'Gånger dina aktiva jobb sparats', emptyHint: 'Inga sparade ännu' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages', emptyHint: 'Inga olästa' },
  ], [displayActiveJobs, newApplicationsCount, savedFavoritesCount, unreadMessagesCount]);

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

EmployerStatsCard.displayName = 'EmployerStatsCard';
