import { memo, useMemo, useEffect } from 'react';
import { Briefcase, Heart, UserPlus, MessageSquare } from 'lucide-react';
import { useJobsData } from '@/hooks/useJobsData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isEmployerJobActive } from '@/lib/jobStatus';
import { StatsCarousel } from './StatsCarousel';
import type { StatData } from './StatsCarousel';

const EMPLOYER_STATS_CACHE_PREFIX = 'parium-employer-stats';
/** Kontoskopad nyckel – siffror får aldrig läcka mellan arbetsgivarkonton i samma webbläsare. */
const statsCacheKey = (uid?: string | null) => `${EMPLOYER_STATS_CACHE_PREFIX}:${uid ?? 'anon'}`;

const readEmployerCachedStats = (uid?: string | null): Record<string, number> => {
  try {
    // Rensa bort äldre, okontoskopad cache så gamla siffror inte kan visas för fel konto.
    localStorage.removeItem(EMPLOYER_STATS_CACHE_PREFIX);
    const raw = localStorage.getItem(statsCacheKey(uid));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

const writeEmployerCachedStat = (uid: string | null | undefined, key: string, value: number) => {
  try {
    const current = readEmployerCachedStats(uid);
    current[key] = value;
    localStorage.setItem(statsCacheKey(uid), JSON.stringify(current));
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
  const cachedStats = useMemo(() => readEmployerCachedStats(user?.id), [user?.id]);

  // Samma statusregler som /my-jobs och databasens räknare (jobStatus.ts) –
  // annars kan "Aktiva annonser" här visa ett annat tal än annonslistan.
  const activeJobIds = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(j => isEmployerJobActive(j)).map(j => j.id);
  }, [jobs]);

  const { data: dashStats, isSuccess } = useQuery({
    queryKey: ['employer-dashboard-stats', user?.id, activeJobIds],
    queryFn: async () => {
      const empty = { new_applications: 0, saved_favorites: 0, unread_messages: 0 };
      if (!user?.id) return empty;
      // Inga aktiva annonser → siffrorna ÄR noll. Skriv även cachen, annars
      // kan gamla värden ligga kvar och visas nästa gång sidan öppnas.
      if (activeJobIds.length === 0) {
        writeEmployerCachedStat(user.id, 'new_applications', 0);
        writeEmployerCachedStat(user.id, 'saved_favorites', 0);
        writeEmployerCachedStat(user.id, 'unread_messages', 0);
        return empty;
      }
      const { data, error } = await supabase.rpc('get_employer_dashboard_stats', {
        p_user_id: user.id,
        p_active_job_ids: activeJobIds,
      });
      if (error) throw error;
      const stats = data as { new_applications: number; saved_favorites: number; unread_messages: number };
      writeEmployerCachedStat(user.id, 'new_applications', stats.new_applications);
      writeEmployerCachedStat(user.id, 'saved_favorites', stats.saved_favorites);
      writeEmployerCachedStat(user.id, 'unread_messages', stats.unread_messages);
      return stats;
    },
    // Vänta tills annonserna laddats – annars skulle vi räkna "0 aktiva" på
    // en halvladdad lista och nolla korten i en blink.
    enabled: !!user?.id && !jobsLoading,
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
    // Realtime + visibility-trigger ersätter polling – ingen 60s-interval behövs
    return () => {
      supabase.removeChannel(msgChannel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, queryClient]);

  const activeJobsCount = activeJobIds.length;
  useEffect(() => {
    if (!jobsLoading && activeJobsCount > 0) {
      writeEmployerCachedStat(user?.id, 'active_jobs', activeJobsCount);
    }
  }, [activeJobsCount, jobsLoading, user?.id]);

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
