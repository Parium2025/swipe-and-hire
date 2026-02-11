import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Heart, X, MapPin, Building2, Users, Briefcase, Timer, ChevronLeft, Share2, ChevronUp, CheckCircle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { formatDateShortSv, getTimeRemaining } from '@/lib/date';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SwipeJob {
  id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type?: string;
  job_image_url?: string;
  views_count: number;
  applications_count: number;
  created_at: string;
  expires_at?: string;
  employer_id?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

interface SwipeFullscreenProps {
  jobs: SwipeJob[];
  appliedJobIds: Set<string>;
  onClose: () => void;
}

export function SwipeFullscreen({ jobs, appliedJobIds, onClose }: SwipeFullscreenProps) {
  const navigate = useNavigate();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentJob = jobs[currentIndex];
  const progress = jobs.length > 0 ? ((currentIndex + 1) / jobs.length) * 100 : 0;

  // Resolve image URL
  const resolveImageUrl = useCallback((url?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const { data } = supabase.storage.from('job-images').getPublicUrl(url);
    return data?.publicUrl || null;
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < jobs.length - 1) {
      setDirection('up');
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, jobs.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection('down');
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleSwipeLeft = useCallback(() => {
    if (!currentJob) return;
    // Navigate to job detail/application page
    navigate(`/job-view/${currentJob.id}`);
  }, [currentJob, navigate]);

  const handleSave = useCallback(() => {
    if (!currentJob) return;
    toggleSaveJob(currentJob.id);
  }, [currentJob, toggleSaveJob]);

  const handleShare = useCallback(async () => {
    if (!currentJob) return;
    const url = `${window.location.origin}/job-view/${currentJob.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentJob.title,
          text: `${currentJob.title} hos ${currentJob.company_name}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Länk kopierad!', description: 'Jobblänken har kopierats till urklipp.' });
    }
  }, [currentJob]);

  // Handle drag end for vertical + horizontal swipe
  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipeThreshold = 80;
    const velocityThreshold = 300;

    // Horizontal swipe left = interested → job detail
    if (offset.x < -swipeThreshold || velocity.x < -velocityThreshold) {
      handleSwipeLeft();
      return;
    }

    // Vertical swipe up = next job
    if (offset.y < -swipeThreshold || velocity.y < -velocityThreshold) {
      goNext();
      return;
    }

    // Vertical swipe down = previous job
    if (offset.y > swipeThreshold || velocity.y > velocityThreshold) {
      goPrev();
      return;
    }
  }, [handleSwipeLeft, goNext, goPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'k') goPrev();
      if (e.key === 'ArrowDown' || e.key === 'j') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'Enter') handleSwipeLeft();
      if (e.key === 'Escape') onClose();
      if (e.key === 's') handleSave();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, handleSwipeLeft, onClose, handleSave]);

  if (!currentJob) {
    return (
      <div className="fixed inset-0 z-[100] bg-parium-gradient flex flex-col items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Alla jobb visade!</h2>
          <p className="text-white/70 max-w-xs">Du har gått igenom alla tillgängliga jobb i din sökning.</p>
          <button onClick={onClose} className="h-12 px-8 bg-white/10 border border-white/20 rounded-full text-white font-medium active:scale-95 transition-transform">
            Tillbaka till sökning
          </button>
        </motion.div>
      </div>
    );
  }

  const imageUrl = resolveImageUrl(currentJob.job_image_url);
  const { text: timeText, isExpired } = getTimeRemaining(currentJob.created_at, currentJob.expires_at);
  const saved = isJobSaved(currentJob.id);
  const applied = appliedJobIds.has(currentJob.id);

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-parium-gradient flex flex-col overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] h-14 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1 text-white active:scale-95 transition-transform min-h-[44px] min-w-[44px]" aria-label="Stäng">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Tillbaka</span>
        </button>
        <div className="text-white/70 text-sm font-medium">
          {currentIndex + 1} / {jobs.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/10 shrink-0">
        <motion.div className="h-full bg-white/60" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Swipeable Card Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={currentJob.id}
            className="absolute inset-0 flex flex-col"
            initial={{ 
              y: direction === 'up' ? '100%' : direction === 'down' ? '-100%' : 0,
              x: direction === 'left' ? '-100%' : 0,
              opacity: 0 
            }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            exit={{ 
              y: direction === 'up' ? '-100%' : direction === 'down' ? '100%' : 0,
              x: direction === 'left' ? '-100%' : 0,
              opacity: 0 
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'none' }}
          >
            {/* Hero Image / Gradient */}
            <div className="relative h-[45%] shrink-0 overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={currentJob.title} className="w-full h-full object-cover" loading="eager" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                  <Building2 className="w-20 h-20 text-white/15" />
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(215,85%,18%)] via-transparent to-transparent" />
              
              {/* Swipe hint overlay - left */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/40">
                <ChevronLeft className="w-5 h-5 animate-pulse" />
                <span className="text-xs">Svep för att ansöka</span>
              </div>

              {/* Applied badge */}
              {applied && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-green-500/80 text-white border-0 shadow-lg">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Redan sökt
                  </Badge>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 px-5 pt-5 pb-4 overflow-y-auto space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Title + Company */}
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">{currentJob.title}</h2>
                <div className="flex items-center gap-2 mt-2 text-white/80">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{currentJob.company_name}</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {currentJob.location && (
                  <Badge variant="glass" className="text-sm">
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    {currentJob.location}
                  </Badge>
                )}
                {currentJob.employment_type && (
                  <Badge variant="glass" className="text-sm">
                    <Briefcase className="w-3.5 h-3.5 mr-1" />
                    {getEmploymentTypeLabel(currentJob.employment_type)}
                  </Badge>
                )}
                <Badge variant="glass" className="text-sm">
                  <Users className="w-3.5 h-3.5 mr-1" />
                  {currentJob.applications_count || 0} sökande
                </Badge>
                {!isExpired && (
                  <Badge variant="glass" className="text-sm">
                    <Timer className="w-3.5 h-3.5 mr-1" />
                    {timeText} kvar
                  </Badge>
                )}
                {isExpired && (
                  <Badge className="bg-red-500/20 text-white border-red-500/30 text-sm">
                    Utgången
                  </Badge>
                )}
              </div>

              {/* Description preview */}
              {currentJob.description && (
                <p className="text-white/70 text-sm leading-relaxed line-clamp-4">
                  {currentJob.description.replace(/<[^>]*>/g, '').substring(0, 300)}
                </p>
              )}

              {/* View more prompt */}
              <button
                onClick={() => navigate(`/job-view/${currentJob.id}`)}
                className="flex items-center gap-2 text-white/60 text-sm active:scale-95 transition-transform"
              >
                <Eye className="w-4 h-4" />
                <span>Visa fullständig annons</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Actions */}
      <div className="shrink-0 px-4 pb-[env(safe-area-inset-bottom)] pb-6">
        {/* Navigation hint */}
        <div className="flex items-center justify-center gap-1 text-white/30 text-xs mb-3">
          <ChevronUp className="w-3 h-3" />
          <span>Svep upp för nästa jobb</span>
        </div>

        <div className="flex items-center justify-center gap-5">
          {/* Skip button */}
          <button
            onClick={goNext}
            className="w-14 h-14 rounded-full bg-white/5 border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Nästa jobb"
          >
            <X className="w-6 h-6 text-white/70" />
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              saved
                ? 'bg-red-500/20 border-2 border-red-400/50'
                : 'bg-white/5 border-2 border-white/20'
            }`}
            aria-label={saved ? 'Sparad' : 'Spara jobb'}
          >
            <Heart className={`w-7 h-7 transition-all ${saved ? 'text-red-400 fill-red-400 scale-110' : 'text-white'}`} />
          </button>

          {/* Apply / View button */}
          <button
            onClick={handleSwipeLeft}
            className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Visa och ansök"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="w-14 h-14 rounded-full bg-white/5 border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Dela jobb"
          >
            <Share2 className="w-6 h-6 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
}
