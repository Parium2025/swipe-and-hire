import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Lightbulb,
  Sparkles,
  Calendar,
  Heart,
  FileText,
  Video,
  Building2,
  Phone,
  X,
  Send,
  ExternalLink,
  MessageSquare,
  Users,
  Wallet,
  Rocket,
  TrendingUp,
  Newspaper,
  Clock,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useCandidateInterviews } from '@/hooks/useInterviews';
import { format, isToday, isTomorrow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useCareerTips, CareerTipItem } from '@/hooks/useCareerTips';

// Gradients for each quadrant
const GRADIENTS = {
  tips: 'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  stats: 'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  notes: 'from-violet-500/90 via-purple-600/80 to-purple-700/90',
  interviews: 'from-amber-500/90 via-orange-500/80 to-orange-600/90',
};

// Icon mapping for career tips categories
const tipIconMap: Record<string, React.ElementType> = {
  FileText,
  MessageSquare,
  Users,
  Wallet,
  Rocket,
  TrendingUp,
  Lightbulb,
  Newspaper,
};

// Default gradients for tips without specific gradient
const defaultTipGradients = [
  'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  'from-violet-500/90 via-purple-600/80 to-purple-700/90',
  'from-amber-500/90 via-orange-500/80 to-orange-600/90',
];

// Format published time as "idag HH:MM" or "igår HH:MM"
function formatTipPublishedTime(publishedAt: string | null): string {
  if (!publishedAt) return '';
  
  try {
    const pubDate = new Date(publishedAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const pubDay = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
    
    const timeStr = pubDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    
    if (pubDay.getTime() === today.getTime()) {
      return `idag ${timeStr}`;
    } else if (pubDay.getTime() === yesterday.getTime()) {
      return `igår ${timeStr}`;
    } else {
      return pubDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    }
  } catch {
    return '';
  }
}

// Career Tips Card (Green - Top Left) - EXACT COPY of employer NewsCard structure
const CareerTipsCard = memo(({ isPaused, setIsPaused }: { isPaused: boolean; setIsPaused: (v: boolean) => void }) => {
  const { data: tips, isLoading, error } = useCareerTips();
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const tipsItems = tips?.slice(0, 4) || [];

  const goNext = useCallback(() => {
    if (tipsItems.length > 1) {
      setCurrentIndex(prev => (prev + 1) % tipsItems.length);
    }
  }, [tipsItems.length]);

  const goPrev = useCallback(() => {
    if (tipsItems.length > 1) {
      setCurrentIndex(prev => (prev - 1 + tipsItems.length) % tipsItems.length);
    }
  }, [tipsItems.length]);

  // Auto-rotation every 10 seconds (pauses on hover)
  useEffect(() => {
    if (tipsItems.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % tipsItems.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [tipsItems.length, isPaused]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  // Loading state - EXACT same as employer
  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg h-[200px]`}>
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

  // Error or no tips state
  if (error || !tips || tips.length === 0) {
    return (
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg h-[200px]`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <CardContent className="relative p-4 h-full flex flex-col items-center justify-center">
          <Lightbulb className="h-8 w-8 text-white/60 mb-2" />
          <p className="text-sm text-white/60 text-center">
            Karriärtips laddas...
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentTip = tipsItems[currentIndex];

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.tips} border-0 shadow-lg h-[200px] touch-pan-y`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      
      <CardContent className="relative p-4 h-full flex flex-col">
        {/* Header - EXACT same as employer */}
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-white/10">
            <Newspaper className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] text-white uppercase tracking-wider font-medium">
            NYHETER
          </span>
        </div>
        
        {/* News content - EXACT same structure as employer */}
        <div className="flex-1 flex flex-col justify-center py-2">
          <AnimatePresence mode="wait">
            {currentTip ? (
              <motion.div
                key={currentTip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onClick={() => currentTip.source_url && window.open(currentTip.source_url, '_blank', 'noopener,noreferrer')}
                className={currentTip.source_url ? 'cursor-pointer group' : ''}
              >
                <h3 className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">
                  {currentTip.title}
                </h3>
                <p className="text-xs text-white line-clamp-1 mb-1">
                  {currentTip.summary || currentTip.title}
                </p>
                {currentTip.published_at && (
                  <div className="flex items-center gap-1.5 text-white text-[10px] mb-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTipPublishedTime(currentTip.published_at)}</span>
                  </div>
                )}
                {currentTip.source_url && (
                  <div className="flex items-center gap-1.5 text-white transition-colors">
                    <span className="text-xs">Läs mer</span>
                    <span className="text-[10px] text-white">· {currentTip.source}</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </motion.div>
            ) : (
              <p className="text-xs text-white/60 text-center">Inga nyheter just nu</p>
            )}
          </AnimatePresence>
        </div>
        
        {/* Footer with dots - tight layout with stable positioning */}
        <div className="flex items-center justify-between mt-auto h-6">
          {/* Dot navigation - tight gaps, stable vertical alignment */}
          {tipsItems.length > 1 ? (
            <div className="flex items-center gap-2">
              {tipsItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentIndex(i)}
                  className="w-6 h-6 flex items-center justify-center touch-manipulation"
                  aria-label={`Gå till nyhet ${i + 1}`}
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full",
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

CareerTipsCard.displayName = 'CareerTipsCard';

// Stats data type
type StatData = {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
  link?: string;
};

// Job Seeker Stats Card (Blue - Top Right)
const JobSeekerStatsCard = memo(({ isPaused, setIsPaused }: { isPaused: boolean; setIsPaused: (v: boolean) => void }) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();
  
  // Query for applications count
  const { data: applicationsCount = 0, isLoading: applicationsLoading } = useQuery({
    queryKey: ['my-applications-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', user.id);
      
      if (error) {
        console.error('Error fetching applications count:', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 5000,
  });
  
  // Query for upcoming interviews count
  const { data: interviewsCount = 0, isLoading: interviewsLoading } = useQuery<number>({
    queryKey: ['my-interviews-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('interviews')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['pending', 'confirmed']);
      
      if (error) {
        console.error('Error fetching interviews:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 5000,
  });
  
  // Query for saved jobs count
  const { data: savedJobsCount = 0, isLoading: savedLoading } = useQuery<number>({
    queryKey: ['saved-jobs-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching saved jobs:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 5000,
  });

  // Query for unread messages count
  const { data: unreadMessagesCount = 0, isLoading: messagesLoading } = useQuery<number>({
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

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;
    
    const applicationsChannel = supabase
      .channel('jobseeker-applications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
        }
      )
      .subscribe();
    
    const interviewsChannel = supabase
      .channel('jobseeker-interviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `applicant_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-interviews-count'] });
        }
      )
      .subscribe();
    
    const savedChannel = supabase
      .channel('jobseeker-saved')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_jobs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['saved-jobs-count'] });
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('jobseeker-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(interviewsChannel);
      supabase.removeChannel(savedChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user?.id, queryClient]);

  const isLoading = applicationsLoading || interviewsLoading || savedLoading || messagesLoading;

  const navigate = useNavigate();

  const statsArray: StatData[] = useMemo(() => [
    { icon: Send, label: 'Skickade ansökningar', value: applicationsCount, description: 'Dina jobbansökningar', link: '/my-applications' },
    { icon: Calendar, label: 'Bokade intervjuer', value: interviewsCount, description: 'Kommande intervjuer' },
    { icon: Heart, label: 'Sparade jobb', value: savedJobsCount, description: 'Jobb du sparat', link: '/saved-jobs' },
    { icon: MessageSquare, label: 'Meddelanden', value: unreadMessagesCount, description: 'Olästa meddelanden', link: '/messages' },
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
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
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
              <h3 className="text-sm font-semibold text-white leading-snug mb-1">
                {currentStat.label}
              </h3>
              <div className="text-3xl font-bold text-white">{currentStat.value}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Dot navigation - tight gaps, stable vertical alignment */}
        <div className="flex items-center gap-2 mt-auto h-6">
          {statsArray.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="w-6 h-6 flex items-center justify-center touch-manipulation"
              aria-label={`Gå till statistik ${i + 1}`}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
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

JobSeekerStatsCard.displayName = 'JobSeekerStatsCard';

// Job Seeker Notes Card (Purple - Bottom Left)
const JobSeekerNotesCard = memo(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasLocalEditsRef = useRef(false);
  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const cacheKey = user?.id ? `jobseeker_notes_cache_${user.id}` : 'jobseeker_notes_cache';

  const [content, setContent] = useState(() => {
    if (typeof window === 'undefined') return '';
    if (user?.id) {
      return localStorage.getItem(`jobseeker_notes_cache_${user.id}`) || '';
    }
    return localStorage.getItem('jobseeker_notes_cache') || '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // When user becomes available, load their specific cache
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null && !hasLocalEditsRef.current) {
      setContent(cached);
    }
  }, [cacheKey, user?.id]);

  // Cross-tab sync via localStorage
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

  // Note data type
  type NoteData = { id: string; user_id: string; content: string | null; created_at: string; updated_at: string } | null;

  // Fetch existing note
  const { data: noteData, isFetched } = useQuery<NoteData>({
    queryKey: ['jobseeker-notes', user?.id],
    queryFn: async (): Promise<NoteData> => {
      const { data, error } = await supabase
        .from('jobseeker_notes')
        .select('id, user_id, content, created_at, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as NoteData;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Sync server value into cache
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    if (!noteData) return;

    const serverContent = noteData.content ?? '';
    localStorage.setItem(cacheKey, serverContent);

    if (!hasLocalEditsRef.current) {
      setContent(serverContent);
    }
  }, [noteData, cacheKey, user?.id]);

  const handleChange = useCallback(
    (next: string) => {
      hasLocalEditsRef.current = true;
      setContent(next);

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

  // Character and word count
  const textStats = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const charCount = plainText.length;
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    return { charCount, wordCount };
  }, [content]);

  // Auto-save with debounce
  useEffect(() => {
    if (!user?.id || !isFetched) return;

    const serverContent = noteData?.content ?? '';
    if (content === serverContent) return;

    const timer = setTimeout(async () => {
      if (!navigator.onLine) {
        console.log('Offline - skipping note save');
        return;
      }

      setIsSaving(true);
      try {
        if (noteData?.id) {
          await supabase
            .from('jobseeker_notes')
            .update({ content })
            .eq('id', noteData.id);
        } else {
          await supabase
            .from('jobseeker_notes')
            .insert({ user_id: user.id, content });
        }

        hasLocalEditsRef.current = false;
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ['jobseeker-notes', user.id] });
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
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.notes} border-0 shadow-lg h-[200px]`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        
        <CardContent className="relative p-4 h-full flex flex-col">
          {/* Header with toolbar */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/10">
                <FileText className="h-4 w-4 text-white" strokeWidth={1.5} />
              </div>
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
          
          {/* Notes editor */}
          <div className="flex-1 min-h-0">
            <RichNotesEditor
              value={content}
              onChange={handleChange}
              placeholder="Skriv karriärmål, påminnelser..."
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
                placeholder="Skriv karriärmål, påminnelser..."
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

JobSeekerNotesCard.displayName = 'JobSeekerNotesCard';

// Format interview date
const formatInterviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Idag';
  if (isTomorrow(date)) return 'Imorgon';
  return format(date, 'd MMM', { locale: sv });
};

const formatInterviewTime = (dateStr: string): string => {
  return format(new Date(dateStr), 'HH:mm');
};

// Helper function to get relative time
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

// Job Seeker Interviews Card (Orange - Bottom Right)
const JobSeekerInterviewsCard = memo(() => {
  const { interviews } = useCandidateInterviews();
  const navigate = useNavigate();
  
  const upcomingInterviews = interviews.slice(0, 5);
  const hasMore = interviews.length > 5;

  type LocationType = 'video' | 'office';

  const getLocationIcon = (type: LocationType) => {
    switch (type) {
      case 'video': return Video;
      case 'office': return Building2;
      default: return Calendar;
    }
  };

  const getLocationLabel = (type: LocationType) => {
    switch (type) {
      case 'video': return 'Video';
      case 'office': return 'Kontor';
      default: return '';
    }
  };

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.interviews} border-0 shadow-lg h-[200px]`}>
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
              <p className="text-xs text-white mt-1">Fortsätt söka jobb!</p>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto h-full pr-1 scrollbar-hide">
              {upcomingInterviews.map((interview: any) => {
                const LocationIcon = getLocationIcon(interview.location_type);
                const timeUntil = getTimeUntil(interview.scheduled_at);
                const isUrgent = timeUntil.includes('min') || timeUntil.includes('tim');
                
                // Get company name from joined data
                const employerProfile = interview.job_postings?.profiles ?? (interview as any).profiles;
                const companyName = employerProfile?.company_name ||
                  `${employerProfile?.first_name || ''} ${employerProfile?.last_name || ''}`.trim() ||
                  'Okänt företag';
                
                return (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/10 rounded-lg p-2 cursor-pointer hover:bg-white/15 transition-colors"
                    onClick={() => navigate('/my-applications')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {interview.job_postings?.title || 'Intervju'}
                        </p>
                        <p className="text-[10px] text-white truncate">
                          {companyName}
                        </p>
                      </div>
                      
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-white",
                        isUrgent && "bg-white/20"
                      )}>
                        {timeUntil}
                      </span>
                    </div>
                    
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
        
        {hasMore && (
          <button
            onClick={() => navigate('/my-applications')}
            className="text-[10px] text-white/80 hover:text-white underline underline-offset-2 mt-1 text-center"
          >
            Se alla ({interviews.length})
          </button>
        )}
      </CardContent>
    </Card>
  );
});

JobSeekerInterviewsCard.displayName = 'JobSeekerInterviewsCard';

// Main Dashboard Grid for Job Seekers
export const JobSeekerDashboardGrid = memo(() => {
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
        {/* Top Left - Career Tips (Green) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <CareerTipsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
        </motion.div>
        
        {/* Top Right - Stats (Blue) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <JobSeekerStatsCard isPaused={isCardsPaused} setIsPaused={setIsCardsPaused} />
        </motion.div>
        
        {/* Bottom Left - Notes (Purple) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <JobSeekerNotesCard />
        </motion.div>
        
        {/* Bottom Right - Interviews (Orange) */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <JobSeekerInterviewsCard />
        </motion.div>
      </div>
    </div>
  );
});

JobSeekerDashboardGrid.displayName = 'JobSeekerDashboardGrid';
