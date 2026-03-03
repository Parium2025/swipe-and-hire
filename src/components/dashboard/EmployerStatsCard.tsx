import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, Heart, UserPlus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobsData } from '@/hooks/useJobsData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isJobExpiredCheck } from '@/lib/date';

const GRADIENTS_STATS = 'from-blue-500/90 via-blue-600/80 to-indigo-700/90';

type StatData = {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
  link?: string;
};

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();
  const hasMountedRef = useRef(false);
  const cachedStats = useMemo(() => readEmployerCachedStats(), []);
  const navigate = useNavigate();

  const activeJobIds = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at))
      .map(j => j.id);
  }, [jobs]);

  const { data: newApplicationsCount = cachedStats['new_applications'] ?? 0 } = useQuery({
    queryKey: ['new-applications-count', user?.id, activeJobIds],
    queryFn: async () => {
      if (!user?.id || activeJobIds.length === 0) return 0;
      const { count, error } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .in('job_id', activeJobIds)
        .is('viewed_at', null);
      if (error) return 0;
      const val = count || 0;
      writeEmployerCachedStat('new_applications', val);
      return val;
    },
    enabled: !!user?.id && activeJobIds.length > 0,
    staleTime: Infinity,
  });

  const { data: savedFavoritesCount = cachedStats['saved_favorites'] ?? 0 } = useQuery({
    queryKey: ['saved-favorites-count', user?.id, activeJobIds],
    queryFn: async () => {
      if (!user?.id || activeJobIds.length === 0) return 0;
      const { count, error } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .in('job_id', activeJobIds);
      if (error) return 0;
      const val = count || 0;
      writeEmployerCachedStat('saved_favorites', val);
      return val;
    },
    enabled: !!user?.id && activeJobIds.length > 0,
    staleTime: Infinity,
  });

  const { data: unreadMessagesCount = cachedStats['unread_messages'] ?? 0 } = useQuery({
    queryKey: ['unread-messages-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (error) return 0;
      const val = count || 0;
      writeEmployerCachedStat('unread_messages', val);
      return val;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!user?.id) return;
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['new-applications-count'] });
      queryClient.invalidateQueries({ queryKey: ['saved-favorites-count'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    };
    const msgChannel = supabase
      .channel(`employer-messages-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] }); }
      )
      .subscribe();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') invalidateAll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const pollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['new-applications-count'] });
      queryClient.invalidateQueries({ queryKey: ['saved-favorites-count'] });
    }, 60000);
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
    { icon: Briefcase, label: 'Aktiva annonser', value: displayActiveJobs, description: 'Mina aktiva jobbannonser', link: '/my-jobs?sort=active-first' },
    { icon: UserPlus, label: 'Nya ansökningar', value: newApplicationsCount, description: 'Ansökningar du inte sett ännu', link: '/my-jobs?sort=active-first' },
    { icon: Heart, label: 'Sparade favoriter', value: savedFavoritesCount, description: 'Gånger dina aktiva jobb sparats' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages' },
  ], [displayActiveJobs, newApplicationsCount, savedFavoritesCount, unreadMessagesCount]);

  const goNext = useCallback(() => { setCurrentIndex(prev => (prev + 1) % statsArray.length); }, [statsArray.length]);
  const goPrev = useCallback(() => { setCurrentIndex(prev => (prev - 1 + statsArray.length) % statsArray.length); }, [statsArray.length]);
  const swipeHandlers = useSwipeGesture({ onSwipeLeft: goNext, onSwipeRight: goPrev });

  useEffect(() => {
    if (isPaused || statsArray.length <= 1) return;
    let interval: ReturnType<typeof setInterval>;
    const initialDelay = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % statsArray.length);
      interval = setInterval(() => { setCurrentIndex(prev => (prev + 1) % statsArray.length); }, 10000);
    }, 5000);
    return () => { clearTimeout(initialDelay); if (interval) clearInterval(interval); };
  }, [isPaused, statsArray.length]);

  const currentStat = statsArray[currentIndex];
  const Icon = currentStat.icon;

  return (
    <Card
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS_STATS} border-0 shadow-lg dashboard-card-height touch-pan-y`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

      <CardContent className="relative p-4 sm:p-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">MIN STATISTIK</span>
        </div>

        <div
          className={cn("flex-1 flex flex-col items-center justify-center text-center py-2", currentStat.link && "cursor-pointer")}
          onClick={() => currentStat.link && navigate(currentStat.link)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              initial={hasMountedRef.current ? { opacity: 0, y: 10, scale: 0.98 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col items-center"
              onAnimationComplete={() => { hasMountedRef.current = true; }}
            >
              <h3 className="text-sm sm:text-base font-semibold text-white leading-snug mb-1">{currentStat.label}</h3>
              <div className="text-3xl font-bold text-white">{currentStat.value}</div>
              {currentStat.value === 0 && (
                <p className="text-xs text-white mt-1">{currentStat.description}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="h-6 flex items-center justify-center mt-auto shrink-0">
          <div className="flex items-center gap-1.5">
            {statsArray.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full touch-manipulation transition-none",
                  i === currentIndex ? "bg-white" : "bg-white/30"
                )}
                aria-label={`Gå till statistik ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

EmployerStatsCard.displayName = 'EmployerStatsCard';
