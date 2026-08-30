import { memo, useMemo, useEffect, useRef } from 'react';
import { Send, Calendar, Heart, MessageSquare, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatsCarousel } from './StatsCarousel';
import { useProfileViewStats } from '@/hooks/useProfileViewStats';
import { readCachedStats, writeCachedStat } from '@/lib/jobseekerStatsCache';
import { fetchJobseekerDashboardStats } from '@/lib/jobseekerDashboardStats';
import type { StatData } from './StatsCarousel';

interface JobSeekerStatsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  /** Kanoniskt antal live-intervjuer från den delade useCandidateInterviews-källan. */
  liveInterviewsCount?: number;
  /** True när den delade intervjudatan har laddats klart. */
  interviewsLoaded?: boolean;
  /** Home synlig? Dold Home pausar rotationen. */
  isActive?: boolean;
}

export const JobSeekerStatsCard = memo(({ isPaused, setIsPaused, liveInterviewsCount, interviewsLoaded, isActive = true }: JobSeekerStatsCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cachedStats = useMemo(() => readCachedStats(user?.id), [user?.id]);
  const { stats: viewStats, isSuccess: viewStatsLoaded } = useProfileViewStats();
  // Visa cachat värde tills profilvisningskällan faktiskt lyckats — hookens
  // fallback-nolla får aldrig visas under laddning eller efter fel.
  const profileViewsCount = viewStatsLoaded
    ? viewStats.unique_viewers_30d
    : cachedStats['profile_views'] ?? viewStats.unique_viewers_30d;
  // Skriv bara till cachen efter ett lyckat profilvisningssvar — aldrig
  // fallback-nollan vid initial laddning eller efter ett RPC-fel. En äkta
  // lyckad nolla skrivs fortfarande.
  useEffect(() => {
    if (viewStatsLoaded) writeCachedStat(user?.id, 'profile_views', profileViewsCount);
  }, [profileViewsCount, user?.id, viewStatsLoaded]);

  const { data: dashStats, isSuccess } = useQuery({
    queryKey: ['jobseeker-dashboard-stats', user?.id],
    queryFn: async () => {
      const stats = await fetchJobseekerDashboardStats(user!.id, supabase);
      writeCachedStat(user!.id, 'applications', stats.applications);
      // Intervjuräknaren cachas INTE här — det kanoniska live-antalet från
      // useCandidateInterviews (delad datakälla) skrivs via effekten nedan.
      writeCachedStat(user!.id, 'saved', stats.saved_jobs);
      writeCachedStat(user!.id, 'messages', stats.unread_messages);
      return stats;
    },
    enabled: !!user?.id && isActive,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
    retry: 1,
  });

  const applicationsCount = dashStats?.applications ?? cachedStats['applications'] ?? 0;
  // Intervjuräknaren kommer från den delade live-listan (samma källa som
  // intervjukortet), med cachat värde som fallback före första laddningen.
  const interviewsCount =
    interviewsLoaded && liveInterviewsCount !== undefined
      ? liveInterviewsCount
      : cachedStats['interviews'] ?? liveInterviewsCount ?? 0;
  // Cacha det kanoniska live-antalet först när datan faktiskt laddats.
  useEffect(() => {
    if (interviewsLoaded && liveInterviewsCount !== undefined) {
      writeCachedStat(user?.id, 'interviews', liveInterviewsCount);
    }
  }, [interviewsLoaded, liveInterviewsCount, user?.id]);
  const savedJobsCount = dashStats?.saved_jobs ?? cachedStats['saved'] ?? 0;
  // Olästa meddelanden kommer från den enda globala chattkanalen
  // (ConversationsProvider). Kortet prenumererar därför INTE själv på
  // conversation_messages – vid 100 000 inloggade skulle varje meddelande
  // på hela plattformen annars trigga en RPC per öppen hemvy.
  const conversationsCtx = useConversationsContext();
  const unreadMessagesCount =
    conversationsCtx?.totalUnreadCount ?? dashStats?.unread_messages ?? cachedStats['messages'] ?? 0;
  useEffect(() => { writeCachedStat(user?.id, 'messages', unreadMessagesCount); }, [unreadMessagesCount, user?.id]);

  // 🔒 ÄGARSKAP: kortet prenumererar INTE själv på saved_jobs/job_applications.
  // AuthProvider äger de användarfiltrerade lyssnarna globalt och invaliderar
  // exakt ['jobseeker-dashboard-stats', user.id]. Kortet reagerar bara på
  // tabbfokus när Home faktiskt är aktivt.
  // 🔄 REAKTIVERING: queryn har staleTime Infinity, så en varm cache skulle
  // annars aldrig uppdateras när Home göms och visas igen (och ett realtime-
  // event missats under tiden). Endast en äkta false → true triggar — ref-
  // guarden hindrar dubbelhämtning vid initial mount med isActive=true.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;
    if (!user?.id || !isActive || wasActive) return;
    queryClient.invalidateQueries({
      queryKey: ['jobseeker-dashboard-stats', user.id],
      exact: true,
    });
  }, [isActive, user?.id, queryClient]);

  useEffect(() => {
    if (!user?.id || !isActive) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidateStats = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ['jobseeker-dashboard-stats', user.id], exact: true });
      }, 1200);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidateStats();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, isActive, queryClient]);


  const statsArray: StatData[] = useMemo(() => [
    { icon: Send, label: 'Skickade ansökningar', value: applicationsCount, description: 'Dina jobbansökningar', link: '/my-applications', emptyHint: 'Börja söka jobb!' },
    { icon: Calendar, label: 'Bokade intervjuer', value: interviewsCount, description: 'Kommande intervjuer', emptyHint: 'Inga bokade än', ready: !!interviewsLoaded },
    { icon: Eye, label: 'Profilvisningar', value: profileViewsCount, description: 'Arbetsgivare senaste 30 dagarna', emptyHint: 'Ingen har sett din profil än', ready: viewStatsLoaded },
    { icon: Heart, label: 'Sparade jobb', value: savedJobsCount, description: 'Jobb du sparat', link: '/saved-jobs', emptyHint: 'Spara jobb du gillar' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages', emptyHint: 'Inga olästa' },
  ], [applicationsCount, interviewsCount, interviewsLoaded, profileViewsCount, savedJobsCount, unreadMessagesCount, viewStatsLoaded]);

  return (
    <StatsCarousel
      isActive={isActive}
      stats={statsArray}
      isPaused={isPaused}
      setIsPaused={setIsPaused}
      dataReady={isSuccess}
      hasCachedData={Object.keys(cachedStats).length > 0}
    />
  );
});

JobSeekerStatsCard.displayName = 'JobSeekerStatsCard';
