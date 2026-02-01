import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  <div className="flex items-center justify-center gap-3 mt-3">
    {Array.from({ length: total }).map((_, i) => (
      <button
        key={i}
        onClick={() => onSelect(i)}
        className={cn(
          // Touch-friendly: 44px min touch target with visible 8px dot
          "min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-90 transition-transform",
        )}
        aria-label={`Gå till ${i + 1}`}
      >
        <span className={cn(
          "w-2 h-2 rounded-full transition-none",
          i === current 
            ? "bg-white" 
            : "bg-white/30"
        )} />
      </button>
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
        
        {/* Footer with dots and update time */}
        <div className="flex items-center justify-between mt-auto">
          {/* Dot navigation */}
          {newsItems.length > 1 ? (
            <div className="flex items-center gap-1">
              {newsItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentIndex(i)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-90 transition-transform"
                  aria-label={`Gå till nyhet ${i + 1}`}
                >
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full transition-none",
                    i === currentIndex 
                      ? "bg-white" 
                      : "bg-white/30"
                  )} />
                </button>
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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 h-full flex flex-col">
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
            "flex-1 flex flex-col justify-center py-2",
            currentStat.link && "cursor-pointer"
          )}
          onClick={() => currentStat.link && navigate(currentStat.link)}
        >
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
              <p className="text-xs text-white">
                {currentStat.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Dot navigation */}
        <div className="flex items-center gap-1 mt-auto">
          {statsArray.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-90 transition-transform"
              aria-label={`Gå till statistik ${i + 1}`}
            >
              <span className={cn(
                "w-2.5 h-2.5 rounded-full transition-none",
                i === currentIndex 
                  ? "bg-white" 
                  : "bg-white/30"
              )} />
            </button>
          ))}
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
    if (!noteData) return; // keep local draft if no row exists yet

    const serverContent = typeof noteData.content === 'string' ? noteData.content : '';
    localStorage.setItem(cacheKey, serverContent);

    if (!hasLocalEditsRef.current) {
      setContent(serverContent);
    }
  }, [noteData, cacheKey, user?.id]);

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

  // Escape key to close fullscreen
  useEffect(() => {
    if (!isExpanded) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    
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
        if (noteData?.id) {
          await supabase
            .from('employer_notes')
            .update({ content })
            .eq('id', noteData.id);
        } else {
          await supabase
            .from('employer_notes')
            .insert({ employer_id: user.id, content });
        }

        hasLocalEditsRef.current = false;
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ['employer-notes', user.id] });
      } catch (err) {
        console.error('Failed to save note:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [content, user?.id, isFetched, noteData, queryClient]);

  return (
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder1} border-0 shadow-lg h-[200px]`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        
        <CardContent className="relative p-4 h-full flex flex-col">
          {/* Header with toolbar integrated */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/10">
                <FileText className="h-4 w-4 text-white" strokeWidth={1.5} />
              </div>
              {/* Toolbar in header */}
              <NotesToolbar editor={notesEditor} onExpand={handleExpand} />
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <span className="text-[10px] text-white animate-pulse">Sparar...</span>
              )}
              {!isSaving && lastSaved && (
                <span className="text-[10px] text-white">Sparat</span>
              )}
              <span className="text-[10px] text-white uppercase tracking-wider font-medium">
                ANTECKNINGAR
              </span>
            </div>
          </div>
          
          {/* Notes editor - toolbar hidden, more space for writing */}
          <div className="flex-1 min-h-0">
            <RichNotesEditor
              value={content}
              onChange={handleChange}
              placeholder="Skriv påminnelser och anteckningar..."
              hideToolbar
              onEditorReady={handleEditorReady}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Notes Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent 
          hideClose 
          className="max-w-4xl h-[80vh] bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 border-0 p-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col h-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                  <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-semibold text-white">Anteckningar</h2>
                {/* Toolbar */}
                <NotesToolbar editor={expandedEditor} className="ml-4" />
              </div>
              <div className="flex items-center gap-3">
                {isSaving && (
                  <span className="text-xs text-white/80 animate-pulse">Sparar...</span>
                )}
                {!isSaving && lastSaved && (
                  <span className="text-xs text-white/80">Sparat</span>
                )}
                <button
                  onClick={handleCloseExpanded}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
            
            {/* Editor */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <RichNotesEditor
                value={content}
                onChange={handleChange}
                placeholder="Skriv påminnelser och anteckningar..."
                hideToolbar
                onEditorReady={handleExpandedEditorReady}
                className="h-full [&_.ProseMirror]:min-h-[300px]"
              />
            </div>
            
            {/* Character/word counter */}
            <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t border-white/10">
              <span className="text-xs text-white">
                {textStats.charCount} tecken
              </span>
              <span className="text-xs text-white">
                {textStats.wordCount} ord
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
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder2} border-0 shadow-lg h-[200px]`}>
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
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.placeholder2} border-0 shadow-lg h-[200px]`}>
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-3 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-white/10">
            <Calendar className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">INTERVJUER</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {upcomingInterviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full">
              <Calendar className="h-8 w-8 text-white/60 mb-2" />
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
  // Shared pause state - hovering on either green or blue card pauses both
  const [isCardsPaused, setIsCardsPaused] = useState(false);

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <h2 className="text-lg font-semibold text-white">Din översikt</h2>
        <Sparkles className="h-5 w-5 text-white" />
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {/* Top Left - News (Green) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <NewsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
        </motion.div>
        
        {/* Top Right - Stats (Blue) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <StatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
        </motion.div>
        
        {/* Bottom Left - Notes (Purple) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <NotesCard />
        </motion.div>
        
        {/* Bottom Right - Interviews (Orange) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <InterviewsCard />
        </motion.div>
      </div>
    </div>
  );
});

HomeDashboardGrid.displayName = 'HomeDashboardGrid';
