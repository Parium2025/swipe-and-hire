import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';

import { Send, Calendar, Heart, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GRADIENTS } from './dashboardConstants';

type StatData = {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
  link?: string;
  emptyHint?: string;
};

interface JobSeekerStatsCardProps {
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
}

// Cache helpers for instant rendering on refresh
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
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(current));
  } catch {}
};

export const JobSeekerStatsCard = memo(({ isPaused, setIsPaused }: JobSeekerStatsCardProps) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasMountedRef = useRef(false);
  const queryClient = useQueryClient();
  const cachedStats = useMemo(() => readCachedStats(), []);
  
  const { data: applicationsCount = cachedStats['applications'] ?? 0, isSuccess: appSuccess } = useQuery({
    queryKey: ['my-applications-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', user.id);
      if (error) { console.error('Error fetching applications count:', error); return 0; }
      const val = count ?? 0;
      writeCachedStats('applications', val);
      return val;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });
  
  const { data: interviewsCount = cachedStats['interviews'] ?? 0, isSuccess: intSuccess } = useQuery<number>({
    queryKey: ['my-interviews-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('interviews')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['pending', 'confirmed']);
      if (error) { console.error('Error fetching interviews:', error); return 0; }
      const val = count || 0;
      writeCachedStats('interviews', val);
      return val;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });
  
  const { data: savedJobsCount = cachedStats['saved'] ?? 0, isSuccess: savedSuccess } = useQuery<number>({
    queryKey: ['saved-jobs-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) { console.error('Error fetching saved jobs:', error); return 0; }
      const val = count || 0;
      writeCachedStats('saved', val);
      return val;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const { data: unreadMessagesCount = cachedStats['messages'] ?? 0, isSuccess: msgSuccess } = useQuery<number>({
    queryKey: ['unread-messages-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      if (error) { console.error('Error fetching unread messages:', error); return 0; }
      const val = count || 0;
      writeCachedStats('messages', val);
      return val;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const dataReady = appSuccess && intSuccess && savedSuccess && msgSuccess;

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;
    
    const applicationsChannel = supabase
      .channel('jobseeker-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['my-applications-count'] }); }
      ).subscribe();
    
    const interviewsChannel = supabase
      .channel('jobseeker-interviews')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `applicant_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['my-interviews-count'] }); }
      ).subscribe();
    
    const savedChannel = supabase
      .channel('jobseeker-saved')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_jobs', filter: `user_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['saved-jobs-count'] }); }
      ).subscribe();

    const messagesChannel = supabase
      .channel('jobseeker-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] }); }
      ).subscribe();
    
    return () => {
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(interviewsChannel);
      supabase.removeChannel(savedChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user?.id, queryClient]);

  const navigate = useNavigate();

  const statsArray: StatData[] = useMemo(() => [
    { icon: Send, label: 'Skickade ansökningar', value: applicationsCount, description: 'Dina jobbansökningar', link: '/my-applications', emptyHint: 'Börja söka jobb!' },
    { icon: Calendar, label: 'Bokade intervjuer', value: interviewsCount, description: 'Kommande intervjuer', emptyHint: 'Inga bokade än' },
    { icon: Heart, label: 'Sparade jobb', value: savedJobsCount, description: 'Jobb du sparat', link: '/saved-jobs', emptyHint: 'Spara jobb du gillar' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages', emptyHint: 'Inga olästa' },
  ], [applicationsCount, interviewsCount, savedJobsCount, unreadMessagesCount]);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % statsArray.length);
  }, [statsArray.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + statsArray.length) % statsArray.length);
  }, [statsArray.length]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  // Auto-rotation with 5s offset from green card
  useEffect(() => {
    if (isPaused || statsArray.length <= 1) return;
    
    let interval: ReturnType<typeof setInterval>;
    
    const initialDelay = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % statsArray.length);
      interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % statsArray.length);
      }, 10000);
    }, 5000);
    
    return () => {
      clearTimeout(initialDelay);
      if (interval) clearInterval(interval);
    };
  }, [isPaused, statsArray.length]);

  const currentStat = statsArray[currentIndex];
  const Icon = currentStat.icon;

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg dashboard-card-height touch-pan-y`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 bg-white/5" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 sm:p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">
            MIN STATISTIK
          </span>
        </div>
        
        {/* Stats content */}
        <div 
          className={cn(
            "flex-1 flex flex-col items-center justify-center text-center py-2",
            currentStat.link && "cursor-pointer"
          )}
          onClick={() => currentStat.link && navigate(currentStat.link)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentIndex}
              initial={hasMountedRef.current ? { opacity: 0, y: 14, scale: 0.97 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col items-center"
              onAnimationComplete={() => { hasMountedRef.current = true; }}
            >
              <h3 className="text-sm sm:text-base font-semibold text-white leading-snug mb-1">
                {currentStat.label}
              </h3>
              <div className="text-3xl font-bold text-white">
                {currentStat.value}
              </div>
              {currentStat.value === 0 && currentStat.emptyHint && (dataReady || Object.keys(cachedStats).length > 0) && (
                <p className="text-xs text-white mt-1">{currentStat.emptyHint}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Dot navigation - centered */}
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

JobSeekerStatsCard.displayName = 'JobSeekerStatsCard';
