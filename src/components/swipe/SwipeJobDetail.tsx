import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordJobView } from '@/lib/recordJobView';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { Skeleton } from '@/components/ui/skeleton';
import type { SwipeJob } from './types';
import { useSheetDragDismiss } from './hooks/useSheetDragDismiss';
import { useJobDetailData } from './hooks/useJobDetailData';
import { SwipeJobDetailSections } from './jobDetail/SwipeJobDetailSections';

interface SwipeJobDetailProps {
  job: SwipeJob;
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  hasApplied: boolean;
}

export function SwipeJobDetail({ job, open, onClose, onApply, hasApplied }: SwipeJobDetailProps) {
  const { user } = useAuth();

  const {
    dragY,
    sheetControls,
    backdropOpacity,
    scrollRef,
    isAnimatingIn,
    animatedClose,
    handleBackdropDismiss,
    stopSheetPropagation,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleHandleTouchStart,
  } = useSheetDragDismiss(open, onClose);

  const { detail, questions, myAnswers, loading, hasError, retry, viewRecordedRef } =
    useJobDetailData(job.id, open, user?.id);

  // Track view när swipe detail öppnas (en gång per jobb-öppning)
  useEffect(() => {
    if (open && job.id && user?.id && viewRecordedRef.current !== job.id) {
      viewRecordedRef.current = job.id;
      recordJobView(job.id, user.id);
    }
  }, [open, job.id, user?.id, viewRecordedRef]);

  const displayCompanyName = detail?.workplace_name || job.workplace_name || job.company_name || 'Företag';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — smooth fade in synced with sheet slide */}
          <motion.div
            className="absolute inset-0 z-30 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={isAnimatingIn ? undefined : { opacity: backdropOpacity }}
            onPointerDown={handleBackdropDismiss}
            onClick={handleBackdropDismiss}
          />

          {/* Sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-40 max-h-[88dvh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col will-change-transform"
            initial={{ y: '100%' }}
            animate={sheetControls}
            exit={{ y: '100%', transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 } }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
            style={isAnimatingIn ? undefined : { y: dragY }}
            onPointerDown={stopSheetPropagation}
            onClick={stopSheetPropagation}
          >
            {/* Drag handle — always draggable */}
            <div
              className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
              onTouchStart={handleHandleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1.5 rounded-full bg-white/30" />
            </div>

            {/* Close */}
            <button
              onClick={animatedClose}
              className="absolute top-3 right-4 z-10 flex h-11 w-11 !min-h-0 !min-w-0 items-center justify-center touch-manipulation"
              aria-label="Stäng"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all active:scale-90 [@media(hover:hover)]:hover:bg-white/20">
                <X className="h-5 w-5 text-white" />
              </div>
            </button>

            {/* Content */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 space-y-3 touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <div className="px-1 pr-12 pb-1">
                <div className="flex items-start gap-2 mt-1 text-white text-[15px] sm:text-sm min-w-0">
                  <TruncatedText
                    text={displayCompanyName}
                    className="font-medium min-w-0 max-w-full"
                    tooltipSide="bottom"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  />
                  {job.location && (
                    <>
                      <span className="text-white/50 shrink-0">·</span>
                      <span className="shrink-0">{job.location}</span>
                    </>
                  )}
                </div>
                <TruncatedText
                  text={job.title}
                  className="text-xl font-bold text-white leading-[1.2] tracking-tight mt-0.5 line-clamp-2 pb-[0.12em]"
                  tooltipSide="bottom"
                />
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="bg-white/10 rounded-lg p-4 space-y-3">
                    <Skeleton className="h-4 w-24 bg-white/10" />
                    <Skeleton className="h-4 w-full bg-white/10" />
                    <Skeleton className="h-4 w-3/4 bg-white/10" />
                    <Skeleton className="h-4 w-full bg-white/10" />
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 space-y-2">
                    <Skeleton className="h-4 w-32 bg-white/10" />
                    <Skeleton className="h-4 w-48 bg-white/10" />
                    <Skeleton className="h-4 w-40 bg-white/10" />
                  </div>
                </div>
              ) : detail ? (
                <SwipeJobDetailSections
                  job={job}
                  detail={detail}
                  displayCompanyName={displayCompanyName}
                  questions={questions}
                  myAnswers={myAnswers}
                  hasApplied={hasApplied}
                />
              ) : hasError ? (
                <div className="bg-white/10 rounded-lg p-4 text-center space-y-3">
                  <p className="text-white text-[15px] sm:text-sm">
                    Kunde inte hämta jobbet just nu.
                  </p>
                  <button
                    onClick={retry}
                    className="min-h-[44px] px-5 rounded-full bg-white/15 text-white text-[15px] sm:text-sm font-medium transition-all active:scale-[0.97]"
                  >
                    Försök igen
                  </button>
                </div>
              ) : null}
            </div>

            {/* Apply CTA */}
            <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
              <button
                onClick={onApply}
                disabled={hasApplied || hasError}
                className={`w-full h-14 rounded-full font-semibold text-base transition-all active:scale-[0.97] min-h-[44px] ${
                  hasApplied || hasError
                    ? 'bg-green-500 text-white cursor-not-allowed opacity-70'
                    : 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                }`}
              >
                {hasApplied ? 'Redan sökt' : 'Skicka ansökan'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
