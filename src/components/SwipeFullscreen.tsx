import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Heart, X, MapPin, Building2, ChevronLeft, Share2, CheckCircle, Undo2 } from 'lucide-react';
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

// ─── Resolve storage URL ────────────────────────────────────────────
function resolveImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const { data } = supabase.storage.from('job-images').getPublicUrl(url);
  return data?.publicUrl || null;
}

// ─── Single swipeable card ──────────────────────────────────────────
interface CardProps {
  job: SwipeJob;
  isTop: boolean;
  applied: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeComplete: () => void;
  dragEnabled: boolean;
}

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;
const EXIT_X = typeof window !== 'undefined' ? window.innerWidth * 1.5 : 600;

function SwipeCard({ job, isTop, applied, onSwipeRight, onSwipeLeft, onSwipeComplete, dragEnabled }: CardProps) {
  const x = useMotionValue(0);
  
  // Rotation follows drag (-12° to +12°)
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  
  // Opacity of like/nope labels
  const likeOpacity = useTransform(x, [0, 80, 150], [0, 0.5, 1]);
  const nopeOpacity = useTransform(x, [-150, -80, 0], [1, 0.5, 0]);
  
  // Card scale for background card
  const scale = isTop ? 1 : 0.95;
  const yOffset = isTop ? 0 : 8;

  const imageUrl = resolveImageUrl(job.job_image_url);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    
    // Swipe right = like (apply)
    if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      animate(x, EXIT_X, { type: 'spring', stiffness: 600, damping: 30 });
      onSwipeRight();
      setTimeout(onSwipeComplete, 300);
      return;
    }
    
    // Swipe left = nope (skip)
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      animate(x, -EXIT_X, { type: 'spring', stiffness: 600, damping: 30 });
      onSwipeLeft();
      setTimeout(onSwipeComplete, 300);
      return;
    }
    
    // Snap back
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 25 });
  }, [x, onSwipeRight, onSwipeLeft, onSwipeComplete]);

  return (
    <motion.div
      className="absolute inset-4 sm:inset-6 rounded-2xl overflow-hidden shadow-2xl"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        y: yOffset,
        zIndex: isTop ? 10 : 5,
        touchAction: 'none',
      }}
      drag={isTop && dragEnabled ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={false}
      animate={{ scale, y: yOffset }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Image / placeholder background */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={job.title}
            className="w-full h-full object-cover"
            loading="eager"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)] flex items-center justify-center">
            <Building2 className="w-24 h-24 text-white/10" />
          </div>
        )}
      </div>

      {/* Gradient overlay — bottom heavy for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* LIKE stamp */}
      {isTop && (
        <motion.div
          className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-400 text-3xl font-black tracking-wider">LIKE</span>
        </motion.div>
      )}

      {/* NOPE stamp */}
      {isTop && (
        <motion.div
          className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-4 py-1 rotate-12"
          style={{ opacity: nopeOpacity }}
        >
          <span className="text-red-400 text-3xl font-black tracking-wider">NOPE</span>
        </motion.div>
      )}

      {/* Applied badge */}
      {applied && (
        <div className="absolute top-6 left-6 z-20">
          <div className="flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
            <CheckCircle className="h-3.5 w-3.5" />
            Redan sökt
          </div>
        </div>
      )}

      {/* Bottom content — Tinder style */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
        <h2 className="text-2xl font-bold text-white leading-tight tracking-tight">{job.title}</h2>
        
        <div className="flex items-center gap-2 mt-2">
          <Building2 className="w-4 h-4 text-white/80 shrink-0" />
          <span className="text-white/90 font-medium text-base">{job.company_name}</span>
        </div>
        
        {job.location && (
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="w-4 h-4 text-white/70 shrink-0" />
            <span className="text-white/80 text-sm">{job.location}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ─────────────────────────────────────────────────
export function SwipeFullscreen({ jobs, appliedJobIds, onClose }: SwipeFullscreenProps) {
  const navigate = useNavigate();
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);
  const [lastAction, setLastAction] = useState<'like' | 'nope' | null>(null);

  const currentJob = jobs[currentIndex];
  const nextJob = jobs[currentIndex + 1];

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (animating) return;
      if (e.key === 'ArrowRight') triggerLike();
      if (e.key === 'ArrowLeft') triggerNope();
      if (e.key === 'Escape') onClose();
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) handleUndo();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [animating, currentIndex]);

  const advanceCard = useCallback(() => {
    setHistory(prev => [...prev, currentIndex]);
    setCurrentIndex(prev => prev + 1);
    setAnimating(false);
  }, [currentIndex]);

  const triggerLike = useCallback(() => {
    if (animating || !currentJob) return;
    setAnimating(true);
    setLastAction('like');
    // Navigate to application after animation
    const jobId = currentJob.id;
    setTimeout(() => {
      navigate(`/job-application/${jobId}`);
    }, 350);
  }, [animating, currentJob, navigate]);

  const triggerNope = useCallback(() => {
    if (animating || !currentJob) return;
    setAnimating(true);
    setLastAction('nope');
  }, [animating, currentJob]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
    setLastAction(null);
  }, [history]);

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
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Länk kopierad!' });
    }
  }, [currentJob]);

  // ─── Empty state ────────────────────────────────────────────────
  if (!currentJob) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-parium-gradient flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Inga fler jobb!</h2>
          <p className="text-white/60 max-w-xs">Du har gått igenom alla tillgängliga jobb. Försök ändra dina filter.</p>
          <button
            onClick={onClose}
            className="h-12 px-8 bg-white/10 border border-white/20 rounded-full text-white font-medium active:scale-95 transition-transform min-h-[44px]"
          >
            Tillbaka till sökning
          </button>
        </motion.div>
      </div>,
      document.body
    );
  }

  const saved = isJobSaved(currentJob.id);
  const applied = appliedJobIds.has(currentJob.id);

  // ─── Main render ────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-parium-gradient flex flex-col" style={{ touchAction: 'none' }}>
      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 h-14 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-white active:scale-95 transition-transform min-h-[44px] min-w-[44px]"
          aria-label="Tillbaka"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Tillbaka</span>
        </button>
        <span className="text-white/50 text-sm font-medium">
          {currentIndex + 1} / {jobs.length}
        </span>
      </div>

      {/* Card stack area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background card (next) */}
        {nextJob && (
          <SwipeCard
            key={nextJob.id + '-bg'}
            job={nextJob}
            isTop={false}
            applied={appliedJobIds.has(nextJob.id)}
            onSwipeRight={() => {}}
            onSwipeLeft={() => {}}
            onSwipeComplete={() => {}}
            dragEnabled={false}
          />
        )}

        {/* Top card (current) */}
        <SwipeCard
          key={currentJob.id}
          job={currentJob}
          isTop={true}
          applied={applied}
          onSwipeRight={triggerLike}
          onSwipeLeft={triggerNope}
          onSwipeComplete={advanceCard}
          dragEnabled={!animating}
        />
      </div>

      {/* Bottom action bar — Tinder style */}
      <div className="shrink-0 pb-6 pt-3 px-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)' }}>
        <div className="flex items-center justify-center gap-4">
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/15 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
            aria-label="Ångra"
          >
            <Undo2 className="w-5 h-5 text-yellow-400" />
          </button>

          {/* Nope (X) */}
          <button
            onClick={triggerNope}
            disabled={animating}
            className="w-16 h-16 rounded-full bg-white/5 border-2 border-red-400/40 flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
            aria-label="Skippa"
          >
            <X className="w-8 h-8 text-red-400" />
          </button>

          {/* Save (Heart) */}
          <button
            onClick={handleSave}
            className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              saved
                ? 'bg-blue-500/20 border border-blue-400/50'
                : 'bg-white/5 border border-white/15'
            }`}
            aria-label={saved ? 'Sparad' : 'Spara'}
          >
            <Heart className={`w-5 h-5 transition-all ${saved ? 'text-blue-400 fill-blue-400' : 'text-blue-400'}`} />
          </button>

          {/* Like (Apply) — green, large */}
          <button
            onClick={triggerLike}
            disabled={animating}
            className="w-16 h-16 rounded-full bg-white/5 border-2 border-green-400/40 flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
            aria-label="Gillar — ansök"
          >
            <Heart className="w-8 h-8 text-green-400" />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/15 flex items-center justify-center active:scale-90 transition-all"
            aria-label="Dela"
          >
            <Share2 className="w-5 h-5 text-purple-400" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
