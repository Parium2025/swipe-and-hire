import { memo, useMemo, useEffect } from 'react';
import { Briefcase, Heart, UserPlus, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useConversationsContext } from '@/contexts/ConversationsContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmployerJobsCounts } from '@/hooks/useEmployerScaleStats';
import { StatsCarousel } from './StatsCarousel';
import type { StatData } from './StatsCarousel';

const EMPLOYER_STATS_CACHE_PREFIX = 'parium-employer-stats';
/** Kontoskopad nyckel – siffror får aldrig läcka mellan arbetsgivarkonton i samma webbläsare. */
const statsCacheKey = (uid?: string | null) => `${EMPLOYER_STATS_CACHE_PREFIX}:${uid ?? 'anon'}`;

const readEmployerCachedStats = (uid?: string | null): Record<string, number> => {
  // Innan auth hunnit ladda finns inget konto att koppla siffrorna till.
  // Läs/skriv aldrig en 'anon'-bucket – då kan två konton på samma enhet
  // se varandras siffror i den första renderingen.
  if (!uid) return {};
  try {
    // Rensa bort äldre, okontoskopad cache så gamla siffror inte kan visas för fel konto.
    localStorage.removeItem(EMPLOYER_STATS_CACHE_PREFIX);
    const raw = localStorage.getItem(statsCacheKey(uid));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

const writeEmployerCachedStat = (uid: string | null | undefined, key: string, value: number) => {
  if (!uid) return;
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cachedStats = useMemo(() => readEmployerCachedStats(user?.id), [user?.id]);

  // 🔒 Serverns räknare är sanning. Tidigare räknades aktiva annonser på den
  // lokalt laddade listan – med 5 000 annonser visade kortet först 200 och
  // klättrade sedan uppåt medan bakgrundsströmmen laddade resten.
  const { data: serverCounts, isLoading: countsLoading } = useEmployerJobsCounts('personal');


  const { data: dashStats, isSuccess } = useQuery({
    // 🔒 Nyckeln får INTE innehålla annons-id:n: med 5 000 aktiva annonser
    // blev nyckeln megabytestor och varje ny annons gav en full refetch.
    // Servern räknar själv fram vilka annonser som är aktiva.
    queryKey: ['employer-inbox-stats', user?.id],
    queryFn: async () => {
      const empty = { new_applications: 0, saved_favorites: 0, unread_messages: 0 };
      if (!user?.id) return empty;
      const { data, error } = await supabase.rpc('get_employer_inbox_stats', {
        p_user_id: user.id,
      });
      if (error) throw error;
      const stats = (data ?? empty) as { new_applications: number; saved_favorites: number; unread_messages: number };
      writeEmployerCachedStat(user.id, 'new_applications', stats.new_applications);
      writeEmployerCachedStat(user.id, 'saved_favorites', stats.saved_favorites);
      writeEmployerCachedStat(user.id, 'unread_messages', stats.unread_messages);
      return stats;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
  });


  const newApplicationsCount = dashStats?.new_applications ?? cachedStats['new_applications'] ?? 0;
  const savedFavoritesCount = dashStats?.saved_favorites ?? cachedStats['saved_favorites'] ?? 0;
  // Olästa meddelanden läses från den enda globala chattkanalen i stället för
  // en egen prenumeration på conversation_messages – annars skulle varje
  // meddelande på hela plattformen trigga en RPC per öppen hemvy.
  const conversationsCtx = useConversationsContext();
  const unreadMessagesCount =
    conversationsCtx?.totalUnreadCount ?? dashStats?.unread_messages ?? cachedStats['unread_messages'] ?? 0;
  useEffect(() => {
    writeEmployerCachedStat(user?.id, 'unread_messages', unreadMessagesCount);
  }, [unreadMessagesCount, user?.id]);

  // Serverfunktionen avgör själv vilka annonser som räknas — vi behöver inte
  // längre hålla en lokal id-lista för att filtrera realtime-händelser.


  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Koalescera händelser – annars triggar all aktivitet på plattformen en refetch-storm.
    const invalidateStats = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ['employer-inbox-stats'] });
      }, 1200);
    };
    // Bara ansökningar på våra egna annonser är relevanta.
    const onApplication = () => invalidateStats();
    const msgChannel = createRealtimeChannel(`employer-conv-messages-${user.id}`)
      // "Nya ansökningar" ska tickas upp live, inte först vid fliksbyte.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' },
        onApplication
      )
      .subscribe();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidateStats();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Realtime + visibility-trigger ersätter polling – ingen 60s-interval behövs
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(msgChannel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, queryClient]);


  const activeJobsCount = serverCounts?.active ?? 0;
  useEffect(() => {
    if (!countsLoading && serverCounts) {
      writeEmployerCachedStat(user?.id, 'active_jobs', serverCounts.active);
    }
  }, [serverCounts, countsLoading, user?.id]);

  const displayActiveJobs = serverCounts ? activeJobsCount : (cachedStats['active_jobs'] ?? 0);


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
