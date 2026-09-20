import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, X } from 'lucide-react';
import { CandidateSlide } from './CandidateSlide';
import { CandidateSlideActions } from './CandidateSlideActions';
import { useCandidateMediaPreloader } from '@/hooks/useCandidateMediaPreloader';
import type { ApplicationData } from '@/hooks/useApplicationsData';
import { TruncatedText } from '@/components/ui/truncated-text';
import { hapticSuccess } from '@/lib/haptics';

const CANDIDATE_UNDO_STORAGE_KEY = 'parium-candidate-swipe-undo-stack';

function readCandidateUndoStack(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CANDIDATE_UNDO_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
  } catch {
    return [];
  }
}

function persistCandidateUndoStack(stack: string[]) {
  try {
    if (stack.length === 0) sessionStorage.removeItem(CANDIDATE_UNDO_STORAGE_KEY);
    else sessionStorage.setItem(CANDIDATE_UNDO_STORAGE_KEY, JSON.stringify(stack));
  } catch {
    // Privat läge/full lagring: ångra fortsätter fungera i minnet.
  }
}

export interface CandidateSwipeFilter {
  question: string;
  answers: string[];
}


interface CandidateSwipeViewerProps {
  applications: ApplicationData[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onOpenFullProfile: (application: ApplicationData) => void;
  getDisplayRating: (app: ApplicationData) => number;
  onRemoveCandidate?: (application: ApplicationData) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  /** Kandidater som redan finns i en lista — spara-knappen visas ifylld och låst. */
  savedApplicantIds?: Set<string>;
  /** Öppnar listväljaren för kandidaten. */
  onSaveCandidate?: (application: ApplicationData) => void;
  /** Kvar monterad bakom kandidatprofilen — inget blixtrar fram och positionen bevaras. */
  behind?: boolean;
  /** Frågefilter som skapade urvalet. Visas stabilt över varje kort. */
  activeQuestionFilters?: CandidateSwipeFilter[];
}

/* ── Main Viewer ────────────────────────────────── */
export const CandidateSwipeViewer = memo(function CandidateSwipeViewer({
  applications,
  initialIndex,
  open,
  onClose,
  onOpenFullProfile,
  getDisplayRating,
  onRemoveCandidate,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  savedApplicantIds,
  onSaveCandidate,
  behind = false,
  activeQuestionFilters = [],
}: CandidateSwipeViewerProps) {

  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const endSectionRef = useRef<HTMLDivElement | null>(null);
  const activeSkipRef = useRef<(() => void) | null>(null);
  const transitionTargetIndexRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(initialIndex);
  currentIndexRef.current = currentIndex;
  const skippedStackRef = useRef<string[]>(readCandidateUndoStack());
  const [canUndo, setCanUndo] = useState(() => skippedStackRef.current.length > 0);
  const [undoEntryApplicationId, setUndoEntryApplicationId] = useState<string | null>(null);
  const undoEntryTimerRef = useRef<number | null>(null);
  // Helskärmssvep: varje kandidat är exakt en viewport hög.
  const [slideHeight, setSlideHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  );

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const apply = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height || window.innerHeight;
      document.body.removeChild(probe);
      setSlideHeight(prev => (Math.abs(prev - h) > 1 ? h : prev));
    };
    apply();
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('orientationchange', apply);
    };
  }, [open]);

  const hasEndSection = applications.length > 0;

  /** Positionen för ett kort — läses direkt från DOM, precis som jobbsökarens svep. */
  const getSlideTop = useCallback((idx: number) => {
    const container = scrollRef.current;
    const el = idx === applications.length ? endSectionRef.current : slideRefs.current[idx];
    if (!container || !el) return null;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.min(Math.max(el.offsetTop, 0), maxScrollTop);
  }, [applications.length]);



  /* ── Premium media preloading: bulk-25 on open, rolling 10 ahead / 2 back ── */
  useCandidateMediaPreloader(applications, currentIndex, open, 10, 2, 25);



  // Scrolla till startkandidaten EN gång per öppning — aldrig igen när listan
  // uppdateras (kallstart/efterladdning byter arrayidentitet, vilket tidigare
  // kastade tillbaka användaren till första kandidaten mitt i bläddringen).
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didInitialScrollRef.current = false;
      setUndoEntryApplicationId(null);
      return;
    }
    if (behind || didInitialScrollRef.current) return;
    if (!applications[initialIndex]) return;
    didInitialScrollRef.current = true;
    setCurrentIndex(initialIndex);
    requestAnimationFrame(() => virtualizer.scrollToIndex(initialIndex, { align: 'start' }));
  }, [open, behind, initialIndex, applications, virtualizer]);


  // Track current candidate via scroll position. Under ett programmerat byte
  // får mellanframes inte skriva tillbaka det gamla indexet; det gav både
  // videons dubbelhopp och fel aktivt kort direkt efter Ångra.
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    let bestIdx = currentIndexRef.current;
    let bestDistance = Infinity;

    virtualizer.getVirtualItems().forEach((item) => {
      const dist = Math.abs(item.start - container.scrollTop);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIdx = item.index;
      }
    });

    const targetIndex = transitionTargetIndexRef.current;
    if (targetIndex !== null) {
      const target = virtualizer.getVirtualItems().find((item) => item.index === targetIndex);
      if (target && Math.abs(target.start - container.scrollTop) <= 2) {
        transitionTargetIndexRef.current = null;
        setCurrentIndex(targetIndex);
      }
      return;
    }

    setCurrentIndex(prev => prev !== bestIdx ? bestIdx : prev);
    if (hasMore && !isLoadingMore && bestIdx >= applications.length - 8) {
      onLoadMore?.();
    }
  }, [applications.length, hasMore, isLoadingMore, onLoadMore, virtualizer]);

  // iOS skickar scroll-events tätare än 60 Hz under momentum. Utan rAF-koalescering
  // körs index-beräkning + setState flera gånger per frame, vilket syns som hack
  // mitt i svepet. En avläsning per frame räcker och gör övergången jämn.
  useEffect(() => {
    const container = scrollRef.current;
    if (!open || !container) return;

    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        handleScroll();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [open, handleScroll]);

  const snapToIndex = useCallback((idx: number) => {
    const maximumIndex = applications.length - 1 + (hasEndSection ? 1 : 0);
    if (idx < 0 || idx > maximumIndex) return;
    transitionTargetIndexRef.current = idx;
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    // Samma handoff som i jobbsökarens swipe-läge: det färdiga underlaget
    // ersätts av nästa riktiga kort i samma frame. En rAF-kedja här gav först
    // en tom/halv frame och därefter ett synligt vertikalt hopp på iOS.
    const container = scrollRef.current;
    if (container) {
      container.scrollTo({ top: idx * slideHeight, behavior: 'auto' });
    } else {
      virtualizer.scrollToIndex(idx, { align: 'start' });
    }
    transitionTargetIndexRef.current = null;
  }, [applications.length, hasEndSection, slideHeight, virtualizer]);

  const handleSkip = useCallback(() => {
    const current = applications[currentIndex];
    if (!current) return;

    skippedStackRef.current = [...skippedStackRef.current, current.id].slice(-50);
    persistCandidateUndoStack(skippedStackRef.current);
    setCanUndo(true);

    if (currentIndex === applications.length - 1 && hasMore) onLoadMore?.();
    snapToIndex(currentIndex + 1);
  }, [applications, currentIndex, hasMore, onLoadMore, snapToIndex]);

  const handleUndo = useCallback(() => {
    const stack = skippedStackRef.current;
    const applicationId = stack[stack.length - 1];
    if (!applicationId) return;
    const restoredIndex = applications.findIndex((application) => application.id === applicationId);
    skippedStackRef.current = stack.slice(0, -1);
    persistCandidateUndoStack(skippedStackRef.current);
    setCanUndo(skippedStackRef.current.length > 0);
    if (restoredIndex >= 0) {
      setUndoEntryApplicationId(applicationId);
      hapticSuccess();
      snapToIndex(restoredIndex);
      if (undoEntryTimerRef.current !== null) window.clearTimeout(undoEntryTimerRef.current);
      undoEntryTimerRef.current = window.setTimeout(() => {
        undoEntryTimerRef.current = null;
        setUndoEntryApplicationId(null);
      }, 700);
    }
  }, [applications, snapToIndex]);

  useEffect(() => () => {
    if (undoEntryTimerRef.current !== null) window.clearTimeout(undoEntryTimerRef.current);
  }, []);

  const registerActiveSkip = useCallback((skip: (() => void) | null) => {
    activeSkipRef.current = skip;
  }, []);

  const handleActionSkip = useCallback(() => {
    activeSkipRef.current?.();
  }, []);

  const currentApplication = applications[currentIndex];
  const isEndSection = hasEndSection && currentIndex === applications.length;
  const isComplete = isEndSection && !hasMore;


  // Lätt haptik vid kandidatbyte — endast i svepvyn, aldrig vid första renderingen.
  const lastHapticIndex = useRef<number | null>(null);
  useEffect(() => {
    if (!open) {
      lastHapticIndex.current = null;
      return;
    }
    if (lastHapticIndex.current === null) {
      lastHapticIndex.current = currentIndex;
      return;
    }
    if (lastHapticIndex.current === currentIndex) return;
    lastHapticIndex.current = currentIndex;
    try {
      navigator.vibrate?.(8);
    } catch {
      // Vissa webbläsare blockerar vibration — ignorera tyst.
    }
  }, [open, currentIndex]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`fixed inset-0 bg-parium-gradient ${behind ? 'z-[40] pointer-events-none' : 'z-[100]'}`}
        aria-hidden={behind || undefined}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <div className="py-3">
            <span className="text-xs text-white font-medium tabular-nums">
              {applications.length === 0 ? '0 / 0' : `${Math.min(currentIndex + 1, applications.length)} / ${applications.length}`}
            </span>
          </div>
          <div className="py-3">
          <button onClick={onClose} className="flex h-12 w-12 items-center justify-center touch-manipulation" aria-label="Stäng">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors">
              <X className="h-5 w-5 text-white" />
            </div>
          </button>
          </div>
        </div>

        {activeQuestionFilters.length > 0 && (
          <div className="pointer-events-none absolute left-4 right-16 top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-white/20 bg-card-parium/90 px-3 py-2 shadow-lg backdrop-blur-md">
              <span className="shrink-0 text-[11px] font-semibold uppercase text-white">Filter</span>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
                {activeQuestionFilters.map((filter) => {
                  const answer = filter.answers.length === 0 ? 'Alla' : filter.answers.join(', ');
                  const label = `${filter.question}: ${answer}`;
                  return (
                    <span
                      key={`${filter.question}:${answer}`}
                      className="pointer-events-auto inline-flex min-w-0 max-w-full shrink rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white"
                    >
                      <TruncatedText text={label} className="min-w-0 truncate" />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Compact position indicator — never creates thousands of DOM nodes. */}
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1.5 transition-opacity duration-200 ${isEndSection ? 'opacity-0' : 'opacity-100'}`}>
          {Array.from({ length: Math.min(applications.length, 7) }, (_, offset) => {
            const start = Math.max(0, Math.min(currentIndex - 3, applications.length - 7));
            const idx = start + offset;
            return (
            <div
              key={idx}
              className={`rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/30'}`}
            />
            );
          })}
        </div>

        {applications.length === 0 && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center px-8 text-center">
            <p className="text-white font-semibold">Inga kandidater att svepa igenom</p>
            <p className="mt-2 text-sm text-white">Lägg till kandidater i din lista eller ändra dina urvalskriterier.</p>
          </div>
        )}

        {/* Helskärmssvep — en kandidat per skärm, med snapp */}
        <div
          ref={scrollRef}
          className="h-full w-full overflow-x-hidden overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'layout style paint',
            scrollSnapType: 'y mandatory',
            touchAction: 'pan-y',
          }}
        >
          {applications.map((app, idx) => {
            // Exakt samma modell som jobbsökarens svep: korten ligger i normalt
            // flöde med fast höjd och snap-start. Endast ±2 kort monteras.
            const withinWindow = Math.abs(idx - currentIndex) <= 2;
            return (
              <div
                key={app.id}
                ref={(el) => { slideRefs.current[idx] = el; }}
                data-index={idx}
                className="w-full shrink-0 snap-start snap-always"
                style={{
                  minHeight: `${slideHeight}px`,
                  height: `${slideHeight}px`,
                  contain: 'layout style paint',
                }}
              >
                {withinWindow ? (
                  <CandidateSlide
                    application={app}
                    rating={getDisplayRating(app)}
                    onOpenFullProfile={() => onOpenFullProfile(app)}
                    onRemoveFromList={onRemoveCandidate ? () => onRemoveCandidate(app) : undefined}
                    isVisible={Math.abs(idx - currentIndex) <= 1}
                    isActive={idx === currentIndex}
                    nextApplication={applications[idx + 1]}
                    isUndoEntry={app.id === undoEntryApplicationId}
                    onSkip={handleSkip}
                    onRegisterSkip={registerActiveSkip}
                  />
                ) : null}
              </div>
            );
          })}

          {hasEndSection && (
            <div
              ref={endSectionRef}
              data-index={applications.length}
              className="w-full shrink-0 snap-start snap-always"
              style={{ minHeight: `${slideHeight}px`, height: `${slideHeight}px` }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] text-center">
                {hasMore ? (
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Laddar fler kandidater" />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={isComplete ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-[27rem] rounded-[1.75rem] border border-white/25 bg-primary/30 px-8 py-6 shadow-2xl"
                  >
                    <p className="text-[15px] font-semibold text-white sm:text-base">Det här är alla kandidater</p>
                    <p className="mt-2 text-[13px] text-white sm:text-sm">Du har gått igenom hela listan.</p>
                  </motion.div>
                )}

                {canUndo && !hasMore && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    data-swipe-action-button
                    className="mt-5 flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 shadow-lg transition-transform active:scale-[0.93] touch-manipulation"
                  >
                    <Undo2 className="h-4.5 w-4.5 text-white" />
                    <span className="text-sm font-medium text-white">Ångra</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {currentApplication && (
          <div
            className="pointer-events-none absolute inset-x-0 z-30 px-5"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.25rem)' }}
          >
            <div className="pointer-events-auto flex justify-center">
              <CandidateSlideActions
                saved={savedApplicantIds ? savedApplicantIds.has(currentApplication.applicant_id) : false}
                canUndo={canUndo}
                onSave={() => onSaveCandidate?.(currentApplication)}
                onSkip={handleActionSkip}
                onOpenInfo={() => onOpenFullProfile(currentApplication)}
                onUndo={handleUndo}
              />
            </div>
          </div>
        )}

      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
