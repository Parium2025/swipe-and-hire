import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Newspaper,
  Sparkles,
  ExternalLink,
  Users,
  Briefcase,
  Heart,
  UserPlus,
  Lightbulb,
  Target,
  Clock,
  MessageSquare
} from 'lucide-react';
import { useHrNews, HrNewsItem } from '@/hooks/useHrNews';
import { useJobsData } from '@/hooks/useJobsData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isJobExpiredCheck } from '@/lib/date';
import { cn } from '@/lib/utils';

// Format relative time for news (e.g. "idag 08:30" or "igår 22:15")
const formatNewsTime = (publishedAt: string | null): string => {
  if (!publishedAt) return '';
  
  try {
    const date = new Date(publishedAt);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const newsDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    
    if (newsDay.getTime() === today.getTime()) {
      return `idag ${timeStr}`;
    } else if (newsDay.getTime() === yesterday.getTime()) {
      return `igår ${timeStr}`;
    } else {
      return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    }
  } catch {
    return '';
  }
};

// Dot navigation component
const DotNavigation = memo(({ 
  total, 
  current, 
  onSelect 
}: { 
  total: number; 
  current: number; 
  onSelect: (index: number) => void;
}) => (
  <div className="flex items-center justify-center gap-2 mt-3">
    {Array.from({ length: total }).map((_, i) => (
      <button
        key={i}
        onClick={() => onSelect(i)}
        className={cn(
          "w-2 h-2 rounded-full transition-all duration-300",
          i === current 
            ? "bg-white scale-110" 
            : "bg-white/30 hover:bg-white/50"
        )}
        aria-label={`Gå till ${i + 1}`}
      />
    ))}
  </div>
));

DotNavigation.displayName = 'DotNavigation';

// Gradients for each quadrant
const GRADIENTS = {
  news: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  stats: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  placeholder1: 'from-violet-500/90 via-purple-600/80 to-purple-700/90',
  placeholder2: 'from-amber-500/90 via-orange-500/80 to-orange-600/90',
};

// News Card (Green - Top Left) - Carousel version
const NewsCard = memo(() => {
  const { data: news, isLoading } = useHrNews();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const newsItems = news?.slice(0, 4) || [];

  const goNext = useCallback(() => {
    if (newsItems.length > 1) {
      setCurrentIndex(prev => (prev + 1) % newsItems.length);
    }
  }, [newsItems.length]);

  const goPrev = useCallback(() => {
    if (newsItems.length > 1) {
      setCurrentIndex(prev => (prev - 1 + newsItems.length) % newsItems.length);
    }
  }, [newsItems.length]);

  // Auto-rotation every 10 seconds (pauses on hover)
  useEffect(() => {
    if (newsItems.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % newsItems.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [newsItems.length, isPaused]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.news} border-0 shadow-lg h-[200px]`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <CardContent className="relative p-6 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
            <Skeleton className="h-4 w-32 bg-white/20" />
          </div>
          <Skeleton className="h-16 w-full bg-white/10 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const currentNews = newsItems[currentIndex];

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.news} border-0 shadow-lg h-[200px] touch-pan-y`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Newspaper className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          {currentNews?.source && (
            <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] text-white/80 font-medium truncate max-w-[120px]">
              {currentNews.source}
            </span>
          )}
        </div>
        
        {/* News content */}
        <div className="flex-1 flex flex-col justify-center py-2">
          <AnimatePresence mode="wait">
            {currentNews ? (
              <motion.div
                key={currentNews.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onClick={() => currentNews.source_url && window.open(currentNews.source_url, '_blank', 'noopener,noreferrer')}
                className={currentNews.source_url ? 'cursor-pointer group' : ''}
              >
                <h3 className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">
                  {currentNews.title}
                </h3>
                <p className="text-xs text-white line-clamp-1 mb-1">
                  {currentNews.summary || currentNews.title}
                </p>
                {currentNews.published_at && (
                  <div className="flex items-center gap-1.5 text-white text-[10px] mb-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatNewsTime(currentNews.published_at)}</span>
                  </div>
                )}
                {currentNews.source_url && (
                  <div className="flex items-center gap-1 text-white transition-colors">
                    <span className="text-xs">Läs mer</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-xs text-white/60 text-center">Inga nyheter just nu</p>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer with dots and update time */}
        <div className="flex items-center justify-between mt-auto">
          {/* Dot navigation */}
          {newsItems.length > 1 ? (
            <div className="flex items-center gap-2">
              {newsItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                    i === currentIndex 
                      ? "bg-white" 
                      : "bg-white/30 hover:bg-white/50"
                  )}
                  aria-label={`Gå till nyhet ${i + 1}`}
                />
              ))}
            </div>
          ) : <div />}
        </div>
      </CardContent>
    </Card>
  );
});

NewsCard.displayName = 'NewsCard';

// Stats data type
type StatData = {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
};

// Stats Card (Blue - Top Right) - Carousel version with real-time updates
const StatsCard = memo(() => {
  const { jobs, isLoading: jobsLoading } = useJobsData({ scope: 'personal' });
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();
  
  // Get active job IDs for queries
  const activeJobIds = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter(j => j.is_active && !isJobExpiredCheck(j.created_at, j.expires_at))
      .map(j => j.id);
  }, [jobs]);
  
  // Query for new applications (viewed_at IS NULL) on user's jobs
  const { data: newApplicationsCount = 0, isLoading: applicationsLoading } = useQuery({
    queryKey: ['new-applications-count', user?.id, activeJobIds],
    queryFn: async () => {
      if (!user?.id || activeJobIds.length === 0) return 0;
      const { count, error } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .in('job_id', activeJobIds)
        .is('viewed_at', null);
      
      if (error) {
        console.error('Error fetching new applications:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user?.id && activeJobIds.length > 0,
    staleTime: 5000,
  });
  
  // Query for saved favorites count on user's active jobs
  const { data: savedFavoritesCount = 0, isLoading: favoritesLoading } = useQuery({
    queryKey: ['saved-favorites-count', user?.id, activeJobIds],
    queryFn: async () => {
      if (!user?.id || activeJobIds.length === 0) return 0;
      const { count, error } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .in('job_id', activeJobIds);
      
      if (error) {
        console.error('Error fetching saved favorites:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user?.id && activeJobIds.length > 0,
    staleTime: 5000,
  });
  
  // Query for unread messages count
  const { data: unreadMessagesCount = 0, isLoading: messagesLoading } = useQuery({
    queryKey: ['unread-messages-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error fetching unread messages:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 5000,
  });

  // Real-time subscriptions for instant updates
  useEffect(() => {
    if (!user?.id) return;
    
    // Subscribe to job_applications changes (new applications, viewed status changes)
    const applicationsChannel = supabase
      .channel('stats-applications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
        },
        (payload) => {
          console.log('Application change detected:', payload.eventType);
          // Invalidate the query to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['new-applications-count'] });
        }
      )
      .subscribe();
    
    // Subscribe to saved_jobs changes
    const savedJobsChannel = supabase
      .channel('stats-saved-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_jobs',
        },
        (payload) => {
          console.log('Saved job change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['saved-favorites-count'] });
        }
      )
      .subscribe();
    
    // Subscribe to messages changes
    const messagesChannel = supabase
      .channel('stats-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Message change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        }
      )
      .subscribe();
    
    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(savedJobsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user?.id, queryClient]);

  const isLoading = jobsLoading || applicationsLoading || favoritesLoading || messagesLoading;

  const statsArray: StatData[] = useMemo(() => {
    const activeJobsCount = activeJobIds.length;
    
    return [
      { icon: Briefcase, label: 'Aktiva annonser', value: activeJobsCount, description: 'Mina aktiva jobbannonser' },
      { icon: UserPlus, label: 'Nya ansökningar', value: newApplicationsCount, description: 'Ansökningar du inte sett ännu' },
      { icon: Heart, label: 'Sparade favoriter', value: savedFavoritesCount, description: 'Gånger dina jobb sparats' },
      { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden' },
    ];
  }, [activeJobIds.length, newApplicationsCount, savedFavoritesCount, unreadMessagesCount]);

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

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg h-[200px]`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <CardContent className="relative p-6 h-full">
          <Skeleton className="h-10 w-10 rounded-xl bg-white/20 mb-4" />
          <Skeleton className="h-16 w-full bg-white/10 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const currentStat = statsArray[currentIndex];
  const Icon = currentStat.icon;

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg h-[200px] touch-pan-y`}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
            MIN STATISTIK
          </span>
        </div>
        
        {/* Stats content */}
        <div className="flex-1 flex flex-col justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-white leading-snug mb-0.5">
                {currentStat.label}
              </h3>
              <div className="text-2xl font-bold text-white mb-1">{currentStat.value}</div>
              <p className="text-xs text-white/70">
                {currentStat.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Dot navigation */}
        <div className="flex items-center gap-2 mt-auto">
          {statsArray.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                i === currentIndex 
                  ? "bg-white" 
                  : "bg-white/30 hover:bg-white/50"
              )}
              aria-label={`Gå till statistik ${i + 1}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

StatsCard.displayName = 'StatsCard';

// Placeholder Cards (Purple & Orange - Bottom)
const PlaceholderCard = memo(({ 
  gradient, 
  icon: Icon, 
  title, 
  description 
}: { 
  gradient: string; 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) => (
  <Card className={`relative overflow-hidden bg-gradient-to-br ${gradient} border-0 shadow-lg h-[200px]`}>
    <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
    
    <CardContent className="relative p-6 h-full flex flex-col items-center justify-center text-center">
      <div className="p-3 rounded-xl bg-white/10 mb-3">
        <Icon className="h-7 w-7 text-white" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </CardContent>
  </Card>
));

PlaceholderCard.displayName = 'PlaceholderCard';

const InsightsCard = memo(() => {
  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder2} border-0 shadow-lg h-[200px]`}>
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Target className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white/70 uppercase tracking-wider font-medium">INSIKTER</span>
        </div>
        
        {/* Coming soon content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <Lightbulb className="h-8 w-8 text-white/40 mb-2" />
          <p className="text-sm font-medium text-white/80">Kommer snart</p>
        </div>
      </CardContent>
    </Card>
  );
});

InsightsCard.displayName = 'InsightsCard';

// Main Dashboard Grid
export const HomeDashboardGrid = memo(() => {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5 text-secondary" />
        <h2 className="text-lg font-semibold text-white">Din översikt</h2>
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {/* Top Left - News (Green) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <NewsCard />
        </motion.div>
        
        {/* Top Right - Stats (Blue) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <StatsCard />
        </motion.div>
        
        {/* Bottom Left - Placeholder (Purple) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <PlaceholderCard 
            gradient={GRADIENTS.placeholder1}
            icon={Lightbulb}
            title="Kommer snart"
            description="Fler funktioner på väg"
          />
        </motion.div>
        
        {/* Bottom Right - Placeholder (Orange) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <InsightsCard />
        </motion.div>
      </div>
    </div>
  );
});

HomeDashboardGrid.displayName = 'HomeDashboardGrid';
