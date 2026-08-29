import { memo, useMemo, useEffect } from 'react';
import { Send, Calendar, Heart, MessageSquare, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatsCarousel } from './StatsCarousel';
import { useProfileViewStats } from '@/hooks/useProfileViewStats';
import { readCachedStats, writeCachedStat } from '@/lib/jobseekerStatsCache';
import type { StatData } from './StatsCarousel';

interface JobSeekerStatsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

export const JobSeekerStatsCard = memo(({ isPaused, setIsPaused }: JobSeekerStatsCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cachedStats = useMemo(() => readCachedStats(), []);
  const { stats: viewStats } = useProfileViewStats();
  const profileViewsCount = viewStats.unique_viewers_30d;
  useEffect(() => { writeCachedStats('profile_views', profileViewsCount); }, [profileViewsCount]);

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
  // Olästa meddelanden kommer från den enda globala chattkanalen
  // (ConversationsProvider). Kortet prenumererar därför INTE själv på
  // conversation_messages – vid 100 000 inloggade skulle varje meddelande
  // på hela plattformen annars trigga en RPC per öppen hemvy.
  const conversationsCtx = useConversationsContext();
  const unreadMessagesCount =
    conversationsCtx?.totalUnreadCount ?? dashStats?.unread_messages ?? cachedStats['messages'] ?? 0;
  useEffect(() => { writeCachedStats('messages', unreadMessagesCount); }, [unreadMessagesCount]);

  // Single consolidated realtime channel – alla lyssnare är användarfiltrerade
  // på servern, och händelser koalesceras så en burst ger EN omhämtning.
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidateStats = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ['jobseeker-dashboard-stats'] });
      }, 1200);
    };
    const statsChannel = createRealtimeChannel(`jobseeker-stats-${user.id}`)
      // job_applications har REPLICA IDENTITY FULL → filtret gäller även DELETE.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${user.id}` },
        invalidateStats
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `applicant_id=eq.${user.id}` },
        invalidateStats
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_jobs', filter: `user_id=eq.${user.id}` },
        invalidateStats
      )
      .subscribe();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidateStats();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(statsChannel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, queryClient]);

  const statsArray: StatData[] = useMemo(() => [
    { icon: Send, label: 'Skickade ansökningar', value: applicationsCount, description: 'Dina jobbansökningar', link: '/my-applications', emptyHint: 'Börja söka jobb!' },
    { icon: Calendar, label: 'Bokade intervjuer', value: interviewsCount, description: 'Kommande intervjuer', emptyHint: 'Inga bokade än' },
    { icon: Eye, label: 'Profilvisningar', value: profileViewsCount, description: 'Arbetsgivare senaste 30 dagarna', emptyHint: 'Ingen har sett din profil än' },
    { icon: Heart, label: 'Sparade jobb', value: savedJobsCount, description: 'Jobb du sparat', link: '/saved-jobs', emptyHint: 'Spara jobb du gillar' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages', emptyHint: 'Inga olästa' },
  ], [applicationsCount, interviewsCount, profileViewsCount, savedJobsCount, unreadMessagesCount]);

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
