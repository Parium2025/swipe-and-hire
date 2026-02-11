import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Heart, X, Share2, ChevronLeft, CheckCircle, Undo2 } from 'lucide-react';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { toast } from '@/hooks/use-toast';
import { SwipeCard, type SwipeJob } from '@/components/swipe/SwipeCard';
import { SwipeJobDetail } from '@/components/swipe/SwipeJobDetail';
import { SwipeApplySheet } from '@/components/swipe/SwipeApplySheet';

export type { SwipeJob };

interface SwipeFullscreenProps {
  jobs: SwipeJob[];
  appliedJobIds: Set<string>;
  onClose: () => void;
}

export function SwipeFullscreen({ jobs, appliedJobIds, onClose }: SwipeFullscreenProps) {
  const { isJobSaved, toggleSaveJob } = useSavedJobs();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [localAppliedIds, setLocalAppliedIds] = useState<Set<string>>(new Set());

  const currentJob = jobs[currentIndex];
  const nextJob = jobs[currentIndex + 1];

  const isApplied = (jobId: string) => appliedJobIds.has(jobId) || localAppliedIds.has(jobId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (animating || showDetail || showApply) return;
      if (e.key === 'ArrowRight') triggerLike();
      if (e.key === 'ArrowLeft') triggerNope();
      if (e.key === 'Escape') onClose();
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) handleUndo();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [animating, currentIndex, showDetail, showApply]);

  const advanceCard = useCallback(() => {
    setHistory(prev => [...prev, currentIndex]);
    setCurrentIndex(prev => prev + 1);
    setAnimating(false);
  }, [currentIndex]);

  const triggerLike = useCallback(() => {
    if (animating || !currentJob) return;
    setAnimating(true);
    // Open apply sheet
    setShowApply(true);
    setAnimating(false);
  }, [animating, currentJob]);

  const triggerNope = useCallback(() => {
    if (animating || !currentJob) return;
    setAnimating(true);
  }, [animating, currentJob]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevIndex = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
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

  const handleTapCard = useCallback(() => {
    if (!currentJob) return;
    setShowDetail(true);
  }, [currentJob]);

  const handleApplyFromDetail = useCallback(() => {
    setShowDetail(false);
    setShowApply(true);
  }, []);

  const handleApplied = useCallback(() => {
    if (currentJob) {
      setLocalAppliedIds(prev => new Set(prev).add(currentJob.id));
    }
    setShowApply(false);
    // Advance to next card
    advanceCard();
  }, [currentJob, advanceCard]);

  const handleCloseApply = useCallback(() => {
    setShowApply(false);
  }, []);

  // Empty state
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
  const applied = isApplied(currentJob.id);

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
        {nextJob && (
          <SwipeCard
            key={nextJob.id + '-bg'}
            job={nextJob}
            isTop={false}
            applied={isApplied(nextJob.id)}
            onSwipeRight={() => {}}
            onSwipeLeft={() => {}}
            onSwipeComplete={() => {}}
            dragEnabled={false}
          />
        )}

        <SwipeCard
          key={currentJob.id}
          job={currentJob}
          isTop={true}
          applied={applied}
          onSwipeRight={triggerLike}
          onSwipeLeft={triggerNope}
          onSwipeComplete={advanceCard}
          onTap={handleTapCard}
          dragEnabled={!animating && !showDetail && !showApply}
        />

        {/* Job detail sheet */}
        <SwipeJobDetail
          job={currentJob}
          open={showDetail}
          onClose={() => setShowDetail(false)}
          onApply={handleApplyFromDetail}
          hasApplied={applied}
        />

        {/* Apply sheet */}
        <SwipeApplySheet
          jobId={currentJob.id}
          jobTitle={currentJob.title}
          companyName={currentJob.company_name}
          open={showApply}
          onClose={handleCloseApply}
          onApplied={handleApplied}
        />
      </div>

      {/* Bottom action bar */}
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

          {/* Like (Apply) */}
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
