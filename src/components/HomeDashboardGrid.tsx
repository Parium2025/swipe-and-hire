import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
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
  MessageSquare,
  FileText,
  Calendar,
  Video,
  Building2,
  Phone,
  X,
  Maximize2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Textarea } from '@/components/ui/textarea';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useHrNews, HrNewsItem } from '@/hooks/useHrNews';
import { useJobsData } from '@/hooks/useJobsData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isJobExpiredCheck } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useInterviews, Interview } from '@/hooks/useInterviews';
import { format, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useOnline } from '@/hooks/useOnlineStatus';

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
          // Important: no transitions here (prevents visible "trails" on some browsers)
          "w-2 h-2 rounded-full transition-none",
          i === current 
            ? "bg-white" 
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
const NewsCard = memo(({ isPaused, setIsPaused }: { isPaused: boolean; setIsPaused: (v: boolean) => void }) => {
  const { data: news, isLoading } = useHrNews();
  const [currentIndex, setCurrentIndex] = useState(0);
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
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.news} border-0 shadow-lg dashboard-card-height`}>
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
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.news} border-0 shadow-lg dashboard-card-height touch-pan-y`}
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
            <Newspaper className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">
            NYHETER
          </span>
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
                <h3 className="text-xs sm:text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">
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
                  <div className="flex items-center gap-1.5 text-white transition-colors">
                    <span className="text-xs">Läs mer</span>
                    <span className="text-[10px] text-white">· {currentNews.source}</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-xs text-white/60 text-center">Inga nyheter just nu</p>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer with dots - centered */}
        <div className="h-6 flex items-center justify-center mt-auto shrink-0">
          {newsItems.length > 1 && (
            <div className="flex items-center gap-1.5">
              {newsItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full touch-manipulation transition-none",
                    i === currentIndex ? "bg-white" : "bg-white/30"
                  )}
                  aria-label={`Gå till nyhet ${i + 1}`}
                />
              ))}
            </div>
          )}
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
  link?: string;
};

// Stats Card (Blue - Top Right) - Carousel version with real-time updates
const StatsCard = memo(({ isPaused, setIsPaused }: { isPaused: boolean; setIsPaused: (v: boolean) => void }) => {
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
    staleTime: Infinity,
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
    staleTime: Infinity,
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
    staleTime: Infinity,
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

  const navigate = useNavigate();

  const statsArray: StatData[] = useMemo(() => {
    const activeJobsCount = activeJobIds.length;
    
    return [
      { icon: Briefcase, label: 'Aktiva annonser', value: activeJobsCount, description: 'Mina aktiva jobbannonser', link: '/my-jobs?sort=active-first' },
      { icon: UserPlus, label: 'Nya ansökningar', value: newApplicationsCount, description: 'Ansökningar du inte sett ännu', link: '/my-jobs?sort=active-first' },
      { icon: Heart, label: 'Sparade favoriter', value: savedFavoritesCount, description: 'Gånger dina aktiva jobb sparats' },
      { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages' },
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

  // Auto-rotation every 10 seconds, offset by 5s from green card
  // Green rotates at 10s, 20s, 30s... Blue at 5s, 15s, 25s... = something changes every 5s
  // When pausing/resuming, both restart fresh which maintains the sync
  useEffect(() => {
    if (isPaused || statsArray.length <= 1) return;
    
    let interval: ReturnType<typeof setInterval>;
    
    // Start with 5s delay to offset from green card
    const initialDelay = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % statsArray.length);
      // THEN start the 10s interval after first rotation
      interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % statsArray.length);
      }, 10000);
    }, 5000);
    
    return () => {
      clearTimeout(initialDelay);
      if (interval) clearInterval(interval);
    };
  }, [isPaused, statsArray.length]);

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.stats} border-0 shadow-lg dashboard-card-height`}>
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
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col items-center"
            >
              <h3 className="text-sm sm:text-base font-semibold text-white leading-snug mb-1">
                {currentStat.label}
              </h3>
              <div className="text-3xl font-bold text-white">
                {currentStat.value}
              </div>
              {currentStat.value === 0 && (
                <p className="text-xs text-white mt-1">
                  {currentStat.description}
                </p>
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

StatsCard.displayName = 'StatsCard';

// Notes Card (Purple - Bottom Left)
const NotesCard = memo(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasLocalEditsRef = useRef(false);
  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedScrollRef = useRef<HTMLDivElement>(null);
  const expandedTrackRef = useRef<HTMLDivElement>(null);
  const expandedThumbRef = useRef<HTMLDivElement>(null);
  const expandedRafRef = useRef<number>(0);

  const cacheKey = user?.id ? `employer_notes_cache_${user.id}` : 'employer_notes_cache';

  const [content, setContent] = useState(() => {
    if (typeof window === 'undefined') return '';
    if (user?.id) {
      return localStorage.getItem(`employer_notes_cache_${user.id}`) || '';
    }
    return localStorage.getItem('employer_notes_cache') || '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // When user becomes available, load their specific cache (but don't clobber active typing)
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null && !hasLocalEditsRef.current) {
      setContent(cached);
    }
  }, [cacheKey, user?.id]);

  // Cross-tab "realtime" feel via localStorage events
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === cacheKey && typeof e.newValue === 'string') {
        if (!hasLocalEditsRef.current) {
          setContent(e.newValue);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cacheKey, user?.id]);

  // Fetch existing note (don't block editor rendering)
  const { data: noteData, isFetched } = useQuery({
    queryKey: ['employer-notes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employer_notes')
        .select('*')
        .eq('employer_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Sync server value into cache (and editor) once it arrives
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    if (!noteData) return;

    const serverContent = typeof noteData.content === 'string' ? noteData.content : '';
    localStorage.setItem(cacheKey, serverContent);

    if (!hasLocalEditsRef.current) {
      setContent(serverContent);
    }
  }, [noteData, cacheKey, user?.id]);

  // Realtime sync — listen for changes from other devices
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`employer-notes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employer_notes',
          filter: `employer_id=eq.${user.id}`,
        },
        (payload) => {
          if (!hasLocalEditsRef.current) {
            const newContent = (payload.new as any)?.content ?? '';
            setContent(newContent);
            if (typeof window !== 'undefined') {
              localStorage.setItem(cacheKey, newContent);
            }
          }
          queryClient.invalidateQueries({ queryKey: ['employer-notes', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, cacheKey, queryClient]);

  const handleChange = useCallback(
    (next: string) => {
      hasLocalEditsRef.current = true;
      setContent(next);

      // Update cache immediately so other tabs can reflect changes instantly
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, next);
      }
    },
    [cacheKey]
  );

  const handleEditorReady = useCallback((editor: Editor) => {
    setNotesEditor(editor);
  }, []);

  const handleExpandedEditorReady = useCallback((editor: Editor) => {
    setExpandedEditor(editor);
  }, []);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Expanded scrollbar tracking
  const updateExpandedScrollbar = useCallback(() => {
    const el = expandedScrollRef.current;
    const track = expandedTrackRef.current;
    const thumb = expandedThumbRef.current;
    if (!el || !track || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasScroll = scrollHeight > clientHeight + 5;
    track.style.display = hasScroll ? '' : 'none';
    if (!hasScroll) return;
    const thumbH = Math.max((clientHeight / scrollHeight) * 100, 20);
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbH) : 0;
    thumb.style.transition = 'top 0.15s ease-out, height 0.15s ease-out';
    thumb.style.top = `${thumbTop}%`;
    thumb.style.height = `${thumbH}%`;
  }, []);

  // Attach scroll listener — retry until element is mounted
  useEffect(() => {
    if (!isExpanded) return;
    let attempts = 0;
    let scrollHandler: (() => void) | null = null;
    let attachedEl: HTMLElement | null = null;

    const tryAttach = () => {
      const el = expandedScrollRef.current;
      if (!el) {
        if (attempts++ < 20) setTimeout(tryAttach, 50);
        return;
      }
      attachedEl = el;
      scrollHandler = () => {
        cancelAnimationFrame(expandedRafRef.current);
        expandedRafRef.current = requestAnimationFrame(updateExpandedScrollbar);
      };
      el.addEventListener('scroll', scrollHandler, { passive: true });
      updateExpandedScrollbar();
      setTimeout(updateExpandedScrollbar, 200);
    };
    tryAttach();

    return () => {
      if (attachedEl && scrollHandler) {
        attachedEl.removeEventListener('scroll', scrollHandler);
      }
      cancelAnimationFrame(expandedRafRef.current);
    };
  }, [isExpanded, updateExpandedScrollbar]);

  // Update scrollbar when content changes in expanded mode
  useEffect(() => {
    if (isExpanded) {
      updateExpandedScrollbar();
      const t = setTimeout(updateExpandedScrollbar, 100);
      return () => clearTimeout(t);
    }
  }, [content, isExpanded, updateExpandedScrollbar]);

  // Escape key to close fullscreen
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Calculate character and word count
  const textStats = useMemo(() => {
    // Strip HTML tags to get plain text
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const charCount = plainText.length;
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    return { charCount, wordCount };
  }, [content]);

  // Auto-save with debounce (wait until we know if note exists to avoid duplicates)
  useEffect(() => {
    if (!user?.id || !isFetched) return;

    const serverContent = typeof noteData?.content === 'string' ? noteData.content : '';
    if (content === serverContent) return;

    const timer = setTimeout(async () => {
      // Check if online before saving
      if (!navigator.onLine) {
        console.log('Offline - skipping note save');
        return;
      }

      setIsSaving(true);
      try {
        let saveError;
        if (noteData?.id) {
          const { error } = await supabase
            .from('employer_notes')
            .update({ content })
            .eq('id', noteData.id);
          saveError = error;
        } else {
          const { error } = await supabase
            .from('employer_notes')
            .insert({ employer_id: user.id, content });
          saveError = error;
        }
        if (saveError) {
          console.error('❌ Employer note save failed:', saveError.message, saveError);
          return;
        }
        hasLocalEditsRef.current = false;
        setLastSaved(new Date());
        console.log('✅ Employer note saved to database');
        queryClient.invalidateQueries({ queryKey: ['employer-notes', user.id] });
      } catch (err) {
        console.error('Failed to save note:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [content, user?.id, isFetched, noteData, queryClient]);

  const saveIndicator = (
    <span className="text-[11px] text-white font-medium">
      {isSaving ? (
        <span className="animate-pulse">Sparar...</span>
      ) : lastSaved ? (
        'Sparat ✓'
      ) : null}
    </span>
  );

  return (
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder1} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        
        <CardContent className="relative p-3 sm:p-4 h-full flex flex-col">
          {/* Header - matching other cards */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/10">
                <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <button
                onClick={handleExpand}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {saveIndicator}
              <span className="text-[10px] text-white uppercase tracking-wider font-medium">
                ANTECKNINGAR
              </span>
            </div>
          </div>

          {/* Row 2: Toolbar - full width */}
          <div className="mb-2 pb-1.5 border-b border-white/10">
            <NotesToolbar editor={notesEditor} compact showUndoRedo={false} />
          </div>
          
          {/* Editor area */}
          <div className="flex-1 min-h-0 relative">
            <RichNotesEditor
              value={content}
              onChange={handleChange}
              placeholder="Skriv påminnelser och anteckningar..."
              hideToolbar
              onEditorReady={handleEditorReady}
            />
            {/* Soft fade at bottom */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-lg"
              style={{ background: 'linear-gradient(to top, rgba(124, 58, 237, 0.7), transparent)' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Notes Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent 
          hideClose 
          className="max-w-4xl w-[calc(100%-2rem)] h-[90dvh] sm:h-[80vh] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 border-0 p-0 !flex !flex-col overflow-hidden"
        >
          <VisuallyHidden>
            <DialogTitle>Anteckningar</DialogTitle>
          </VisuallyHidden>
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col flex-1 min-h-0 p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                  <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">Anteckningar</h2>
              </div>
              <div className="flex items-center gap-3">
                {saveIndicator}
                <button
                  onClick={handleCloseExpanded}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="mb-3 pb-2 border-b border-white/10 shrink-0">
              <NotesToolbar editor={expandedEditor} />
            </div>
            
            {/* Editor — scrollable wrapper with mini scrollbar */}
            <div className="flex-1 min-h-0 relative bg-white/10 rounded-lg overflow-hidden">
              <div 
                ref={expandedScrollRef}
                className="absolute inset-0 overflow-y-auto overscroll-contain touch-auto [-webkit-overflow-scrolling:touch] pr-3"
              >
                <RichNotesEditor
                  value={content}
                  onChange={handleChange}
                  placeholder="Skriv påminnelser och anteckningar..."
                  hideToolbar
                  externalScroll
                  onEditorReady={handleExpandedEditorReady}
                />
              </div>
              {/* Mini scrollbar indicator */}
              <div 
                ref={expandedTrackRef}
                className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-white/10 pointer-events-none"
                aria-hidden="true"
                style={{ display: 'none' }}
              >
                <div 
                  ref={expandedThumbRef}
                  className="absolute w-full rounded-full bg-white/40"
                />
              </div>
            </div>
            
            {/* Character/word counter */}
            <div className="flex items-center justify-end gap-4 mt-2 pt-2 border-t border-white/10 shrink-0">
              <span className="text-xs text-pure-white">
                {textStats.charCount} tecken · {textStats.wordCount} ord
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

NotesCard.displayName = 'NotesCard';

// Format interview date nicely
const formatInterviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Idag';
  if (isTomorrow(date)) return 'Imorgon';
  return format(date, 'd MMM', { locale: sv });
};

const formatInterviewTime = (dateStr: string): string => {
  return format(new Date(dateStr), 'HH:mm');
};

// Helper function to get relative time until interview
const getTimeUntil = (scheduledAt: string): string => {
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const diffMs = scheduled.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Pågår/passerad';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `Om ${diffMins} min`;
  if (diffHours < 24) return `Om ${diffHours} tim`;
  if (diffDays === 1) return 'Imorgon';
  if (diffDays < 7) return `Om ${diffDays} dagar`;
  return formatInterviewDate(scheduledAt);
};

// Interviews Card (Orange - Bottom Right) - List View
const InterviewsCard = memo(() => {
  const { interviews, isLoading } = useInterviews();
  const navigate = useNavigate();
  
  // Show max 5 upcoming interviews
  const upcomingInterviews = interviews.slice(0, 5);
  const hasMore = interviews.length > 5;

  const getLocationIcon = (type: Interview['location_type']) => {
    switch (type) {
      case 'video': return Video;
      case 'office': return Building2;
      default: return Calendar;
    }
  };

  const getLocationLabel = (type: Interview['location_type']) => {
    switch (type) {
      case 'video': return 'Video';
      case 'office': return 'Kontor';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder2} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <CardContent className="relative p-4 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
            <Skeleton className="h-4 w-24 bg-white/20" />
          </div>
          <Skeleton className="h-16 w-full bg-white/10 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder2} border-0 shadow-lg dashboard-card-height`}>
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-3 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-xl bg-white/10">
            <Calendar className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">INTERVJUER</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {upcomingInterviews.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Calendar className="h-8 w-8 text-white mb-2" />
              <p className="text-sm font-medium text-white">Inga bokade intervjuer</p>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto h-full pr-1 scrollbar-hide">
              {upcomingInterviews.map((interview) => {
                const LocationIcon = getLocationIcon(interview.location_type);
                const timeUntil = getTimeUntil(interview.scheduled_at);
                const isUrgent = timeUntil.includes('min') || timeUntil.includes('tim');
                
                return (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/10 rounded-lg p-2 cursor-pointer hover:bg-white/15 transition-colors"
                    onClick={() => navigate('/my-candidates')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Candidate name & job */}
                        <p className="text-xs font-semibold text-white truncate">
                          {interview.candidate_name}
                        </p>
                        <p className="text-[10px] text-white truncate">
                          {interview.job_title}
                        </p>
                      </div>
                      
                      {/* Time until - highlighted if urgent */}
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-white",
                        isUrgent && "bg-white/20"
                      )}>
                        {timeUntil}
                      </span>
                    </div>
                    
                    {/* Date, time & location */}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-white">
                      <span>{formatInterviewDate(interview.scheduled_at)}</span>
                      <span>kl {formatInterviewTime(interview.scheduled_at)}</span>
                      <span className="flex items-center gap-0.5">
                        <LocationIcon className="h-2.5 w-2.5" />
                        {getLocationLabel(interview.location_type)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* See all link */}
        {hasMore && (
          <button
            onClick={() => navigate('/my-candidates')}
            className="text-[10px] text-white/80 hover:text-white underline underline-offset-2 mt-1 text-center"
          >
            Se alla ({interviews.length})
          </button>
        )}
      </CardContent>
    </Card>
  );
});
InterviewsCard.displayName = 'InterviewsCard';

// Main Dashboard Grid
export const HomeDashboardGrid = memo(() => {
  const [isCardsPaused, setIsCardsPaused] = useState(false);
  const isMobile = useIsMobile();

  // Mobile: Statistik → Intervjuer → Nyheter → Anteckningar
  // Desktop: behåll 2x2 grid (Nyheter/Stats top, Notes/Interviews bottom)
  const mobileOrder = (
    <>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <StatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <InterviewsCard />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <NewsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <NotesCard />
      </motion.div>
    </>
  );

  const desktopOrder = (
    <>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <NewsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <StatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <NotesCard />
      </motion.div>
      <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <InterviewsCard />
      </motion.div>
    </>
  );

  return (
    <div className="space-y-2 sm:space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <h2 className="text-base sm:text-lg font-semibold text-white">Din översikt</h2>
        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {isMobile ? mobileOrder : desktopOrder}
      </div>
    </div>
  );
});

HomeDashboardGrid.displayName = 'HomeDashboardGrid';
