import { useState, memo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, X } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { SectionErrorBoundary } from '@/components/candidateProfile';
import { CandidateActivityLog } from '@/components/CandidateActivityLog';
import { CandidateNotesPanel } from '@/components/candidateProfile/CandidateNotesPanel';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { useSheetDragDismiss } from '@/components/swipe/hooks/useSheetDragDismiss';
import { TABS, type TabKey } from './CandidateSlideConstants';
import { CandidateSlideProfileTab } from './CandidateSlideProfileTab';
import { CandidateCardFace } from './CandidateCardFace';
import { CandidateSlideActions } from './CandidateSlideActions';
import type { ApplicationData } from '@/hooks/useApplicationsData';


interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  onRemoveFromList?: () => void;
  isLast: boolean;
  isVisible: boolean;
  /** Åtgärdsraden visas bara när svepvyn kan hantera åtgärderna. */
  showActions?: boolean;
  saved?: boolean;
  canUndo?: boolean;
  onSave?: () => void;
  onSkip?: () => void;
  onUndo?: () => void;
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  rating,
  onOpenFullProfile,
  onRemoveFromList,
  isLast,
  isVisible,
  showActions = false,
  saved = false,
  canUndo = false,
  onSave,
  onSkip,
  onUndo,
}: CandidateSlideProps) {
  const { user } = useAuth();
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const coverImageUrl = useMediaUrl(application.cover_image_url, 'profile-image');
  const signedCvUrl = useMediaUrl(application.cv_url, 'cv');
  const isProfileVideo = application.is_profile_video;
  const initials = `${(application.first_name?.[0] || '').toUpperCase()}${(application.last_name?.[0] || '').toUpperCase()}`;
  const [activeTab, setActiveTab] = useState<TabKey>('profil');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const slideTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsBarRef = useRef<HTMLDivElement | null>(null);
  const [slideIndicator, setSlideIndicator] = useState({ left: 0, width: 0 });

  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  // Infopanelen öppnas och stängs precis som jobbannonsens panel:
  // dra ner med fingret eller tryck på krysset.
  const {
    dragY,
    sheetControls,
    backdropOpacity,
    scrollRef: detailsScrollRef,
    isAnimatingIn,
    animatedClose,
    handleBackdropDismiss,
    stopSheetPropagation,
    handleTouchStart: handleSheetTouchStart,
    handleTouchMove: handleSheetTouchMove,
    handleTouchEnd: handleSheetTouchEnd,
    handleHandleTouchStart,
  } = useSheetDragDismiss(detailsOpen, closeDetails);

  // Varje flikbyte ska börja högst upp i infopanelen.
  useEffect(() => {
    detailsScrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab, detailsOpen, detailsScrollRef]);



  const measureSlideIndicator = useCallback(() => {
    const idx = TABS.findIndex(t => t.key === activeTab);
    const el = slideTabRefs.current[idx];
    if (!el) return;
    const inner = el.querySelector('[data-tab-content]') as HTMLElement | null;
    const target = inner || el;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setSlideIndicator({ left: targetRect.left - parentRect.left, width: targetRect.width });
  }, [activeTab]);

  useEffect(() => {
    // Mätning måste ske efter att info-steget monterats/animerat in.
    measureSlideIndicator();
    const raf = requestAnimationFrame(measureSlideIndicator);
    const t = window.setTimeout(measureSlideIndicator, 320);
    window.addEventListener('resize', measureSlideIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener('resize', measureSlideIndicator);
    };
  }, [measureSlideIndicator, detailsOpen]);


  const handleTabSwipe = useCallback((deltaX: number) => {
    const currentIdx = TABS.findIndex(t => t.key === activeTab);
    if (deltaX < -30 && currentIdx < TABS.length - 1) {
      setSwipeDirection(1);
      setActiveTab(TABS[currentIdx + 1].key);
    } else if (deltaX > 30 && currentIdx > 0) {
      setSwipeDirection(-1);
      setActiveTab(TABS[currentIdx - 1].key);
    }
  }, [activeTab]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swipeLockedRef.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);

    // Lock direction after 10px movement — horizontal only if clearly sideways (dx > dy * 1.5)
    if (!swipeLockedRef.current && (dx > 10 || dy > 10)) {
      swipeLockedRef.current = dx > dy * 1.5 ? 'horizontal' : 'vertical';
    }

    if (swipeLockedRef.current === 'horizontal') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || swipeLockedRef.current !== 'horizontal') {
      touchStartRef.current = null;
      swipeLockedRef.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(deltaX) / elapsed;

    // Accept: 30px distance OR fast flick (velocity > 0.3px/ms with 20px minimum)
    if (Math.abs(deltaX) > 30 || (velocity > 0.3 && Math.abs(deltaX) > 20)) {
      handleTabSwipe(deltaX);
    }

    touchStartRef.current = null;
    swipeLockedRef.current = null;
  }, [handleTabSwipe]);

  // AI summary hook — only actively polls when visible
  const summaryHook = useCandidateSummary({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    applicationId: application.id,
    cvUrl: application.cv_url,
    open: isVisible,
  });

  // Notes hook — destructure for stable refs in deps
  const notesHook = useCandidateNotes({
    applicantId: application.applicant_id,
    jobId: application.job_id,
    enabled: isVisible,
  });
  const { fetchNotes, saveNote, startEditing } = notesHook;

  const [newNote, setNewNote] = useState('');

  // Fetch notes when tab is active
  useEffect(() => {
    if (activeTab === 'anteckningar' && isVisible) {
      fetchNotes();
    }
  }, [activeTab, isVisible, fetchNotes]);

  const handleSaveNote = useCallback(() => {
    saveNote(newNote, () => setNewNote(''));
  }, [newNote, saveNote]);

  const handleStartEditing = useCallback((note: any) => {
    startEditing(note);
  }, [startEditing]);

  return (
    <div className="w-full h-full flex flex-col items-center px-6 pt-12 pb-4">
      <div className="w-full max-w-sm flex-1 min-h-0 flex flex-col items-center gap-3">

        {/* ── Kortfront — identisk med jobbsökarens förhandsgranskning ── */}
        <div className="w-full flex-1 min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <CandidateCardFace
            firstName={application.first_name}
            lastName={application.last_name}
            age={application.age}
            residence={application.location}
            profileImageUrl={profileImageUrl}
            coverImageUrl={coverImageUrl}
            videoUrl={videoUrl}
            hasVideo={!!isProfileVideo}
            ctaLabel="Tryck för mer info"
            onOpen={() => setDetailsOpen(true)}
          />
        </div>

        {/* Åtgärder — samma knappar som jobbsökarens swipe-läge */}
        {showActions && (
          <div className="shrink-0 pt-1">
            <CandidateSlideActions
              saved={saved}
              canUndo={canUndo}
              onUndo={onUndo}
              onSave={() => onSave?.()}
              onSkip={() => onSkip?.()}
              onOpenInfo={() => setDetailsOpen(true)}
            />
          </div>
        )}

        {/* Nästa-kandidat-hint längst ner i helskärmskortet */}
        {!isLast && (
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <ChevronDown className="h-4 w-4 text-white fill-white animate-bounce" />
            <span className="text-[10px] text-white font-medium">Nästa kandidat</span>
          </div>
        )}
      </div>

      {/* ── Steg 2: infopanel — samma panel som jobbannonsen (dra ner eller kryss) ── */}
      <AnimatePresence>
        {detailsOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[115] bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={isAnimatingIn ? undefined : { opacity: backdropOpacity }}
              onPointerDown={handleBackdropDismiss}
              onClick={handleBackdropDismiss}
            />

            <motion.div
              className="fixed inset-x-0 bottom-0 z-[120] max-h-[88dvh] h-[88dvh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col will-change-transform"
              initial={{ y: '100%' }}
              animate={sheetControls}
              exit={{ y: '100%', transition: { type: 'spring', damping: 34, stiffness: 400, mass: 0.8 } }}
              transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
              style={isAnimatingIn ? undefined : { y: dragY }}
              onPointerDown={stopSheetPropagation}
              onClick={stopSheetPropagation}
            >
              {/* Draghandtag */}
              <div
                className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
                onTouchStart={handleHandleTouchStart}
                onTouchMove={handleSheetTouchMove}
                onTouchEnd={handleSheetTouchEnd}
              >
                <div className="w-10 h-1.5 rounded-full bg-white/30" />
              </div>

              {/* Stäng */}
              <button
                onClick={animatedClose}
                className="absolute top-3 right-4 z-10 flex h-11 w-11 !min-h-0 !min-w-0 items-center justify-center touch-manipulation"
                aria-label="Stäng"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all active:scale-90 [@media(hover:hover)]:hover:bg-white/20">
                  <X className="h-5 w-5 text-white" />
                </div>
              </button>

              <div className="shrink-0 px-5 pr-16 pb-2">
                <span className="block truncate text-base font-bold text-white">
                  {`${application.first_name || ''} ${application.last_name || ''}`.trim()}
                </span>
              </div>

            {/* Tabs */}
            <div ref={tabsBarRef} className="shrink-0 mx-6 flex items-center border-b border-white/20 relative">
              <motion.div
                className="absolute bottom-0 h-0.5 bg-white"
                initial={false}
                animate={{ left: slideIndicator.left, width: slideIndicator.width }}
                transition={{ type: 'spring', stiffness: 300, damping: 35, mass: 0.8 }}
              />
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    ref={(el) => { slideTabRefs.current[TABS.indexOf(tab)] = el; }}
                    onClick={() => {
                      const fromIdx = TABS.findIndex(t => t.key === activeTab);
                      const toIdx = TABS.findIndex(t => t.key === tab.key);
                      setSwipeDirection(toIdx > fromIdx ? 1 : -1);
                      setActiveTab(tab.key);
                    }}
                    className={`flex-1 px-1 py-2.5 text-xs font-medium transition-colors min-w-0 ${
                      isActive ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    <div data-tab-content className="flex items-center justify-center gap-1 whitespace-nowrap w-fit mx-auto">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">{tab.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Innehåll */}
            <div
              ref={detailsScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onTouchStart={(e) => { onTouchStart(e); handleSheetTouchStart(e); }}
              onTouchMove={(e) => { onTouchMove(e); handleSheetTouchMove(e); }}
              onTouchEnd={(e) => { onTouchEnd(e); handleSheetTouchEnd(); }}
              onTouchCancel={() => handleSheetTouchEnd()}
            >

              <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
                <motion.div
                  key={activeTab}
                  custom={swipeDirection}
                  initial={{ x: swipeDirection * 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: swipeDirection * -60, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="w-full min-w-0 mx-auto max-w-sm flex flex-col items-center gap-5"
                >
                  {activeTab === 'profil' && (
                    <CandidateSlideProfileTab
                      application={application}
                      rating={rating}
                      profileImageUrl={profileImageUrl}
                      videoUrl={videoUrl}
                      coverImageUrl={coverImageUrl}
                      signedCvUrl={signedCvUrl}
                      isProfileVideo={!!isProfileVideo}
                      initials={initials}
                      summaryHook={summaryHook}
                      onOpenFullProfile={onOpenFullProfile}
                      onRemoveFromList={onRemoveFromList}
                    />
                  )}

                  {activeTab === 'aktivitet' && (
                    <div className="w-full">
                      <SectionErrorBoundary fallbackLabel="Aktivitetslogg">
                        <CandidateActivityLog applicantId={application.applicant_id} />
                      </SectionErrorBoundary>
                    </div>
                  )}

                  {activeTab === 'anteckningar' && (
                    <div className="w-full">
                      <SectionErrorBoundary fallbackLabel="Anteckningar">
                        <CandidateNotesPanel
                          notes={notesHook.notes}
                          loadingNotes={notesHook.loadingNotes}
                          newNote={newNote}
                          onNewNoteChange={setNewNote}
                          onSaveNote={handleSaveNote}
                          savingNote={notesHook.savingNote}
                          currentUserId={user?.id}
                          onStartEditing={handleStartEditing}
                          onConfirmDelete={notesHook.deleteNote}
                          editingNoteId={notesHook.editingNoteId}
                          editingNoteText={notesHook.editingNoteText}
                          originalNoteText={notesHook.originalNoteText}
                          onEditingNoteTextChange={notesHook.setEditingNoteText}
                          onUpdateNote={notesHook.updateNote}
                          onCancelEditing={notesHook.cancelEditing}
                        />
                      </SectionErrorBoundary>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

