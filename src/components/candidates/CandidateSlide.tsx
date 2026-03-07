import { useState, memo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown } from 'lucide-react';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { SectionErrorBoundary } from '@/components/candidateProfile';
import { CandidateActivityLog } from '@/components/CandidateActivityLog';
import { CandidateNotesPanel } from '@/components/candidateProfile/CandidateNotesPanel';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { TABS, type TabKey } from './CandidateSlideConstants';
import { CandidateSlideProfileTab } from './CandidateSlideProfileTab';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface CandidateSlideProps {
  application: ApplicationData;
  rating: number;
  onOpenFullProfile: () => void;
  isLast: boolean;
  isVisible: boolean;
}

export const CandidateSlide = memo(function CandidateSlide({
  application,
  rating,
  onOpenFullProfile,
  isLast,
  isVisible,
}: CandidateSlideProps) {
  const { user } = useAuth();
  const profileImageUrl = useMediaUrl(application.profile_image_url, 'profile-image');
  const videoUrl = useMediaUrl(application.video_url, 'profile-video');
  const signedCvUrl = useMediaUrl(application.cv_url, 'cv');
  const isProfileVideo = application.is_profile_video;
  const initials = `${(application.first_name?.[0] || '').toUpperCase()}${(application.last_name?.[0] || '').toUpperCase()}`;
  const [activeTab, setActiveTab] = useState<TabKey>('profil');
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  const handleTabSwipe = useCallback((deltaX: number) => {
    const currentIdx = TABS.findIndex(t => t.key === activeTab);
    if (deltaX < -50 && currentIdx < TABS.length - 1) {
      setSwipeDirection(1);
      setActiveTab(TABS[currentIdx + 1].key);
    } else if (deltaX > 50 && currentIdx > 0) {
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

    if (!swipeLockedRef.current && (dx > 10 || dy > 10)) {
      swipeLockedRef.current = dx > dy ? 'horizontal' : 'vertical';
    }

    if (swipeLockedRef.current === 'horizontal') {
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

    if (Math.abs(deltaX) > 50 || (Math.abs(deltaX) > 30 && elapsed < 300)) {
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

  // Notes hook
  const notesHook = useCandidateNotes({
    applicantId: application.applicant_id,
    jobId: application.job_id,
  });

  const [newNote, setNewNote] = useState('');

  // Fetch notes when tab is active
  useEffect(() => {
    if (activeTab === 'anteckningar' && isVisible) {
      notesHook.fetchNotes();
    }
  }, [activeTab, isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveNote = useCallback(() => {
    notesHook.saveNote(newNote, () => setNewNote(''));
  }, [newNote, notesHook.saveNote]);

  const handleStartEditing = useCallback((note: any) => {
    notesHook.startEditing(note);
  }, [notesHook.startEditing]);

  return (
    <div className="w-full flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-5">

        {/* ── Tabs — sliding indicator ── */}
        <div className="w-full flex items-center border-b border-white/20 relative">
          <motion.div
            className="absolute bottom-0 h-0.5 bg-white"
            initial={false}
            animate={{
              left: `calc(${TABS.findIndex(t => t.key === activeTab)} * (100% / 3))`,
              width: `calc(100% / 3)`,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 35, mass: 0.8 }}
          />
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  const fromIdx = TABS.findIndex(t => t.key === activeTab);
                  const toIdx = TABS.findIndex(t => t.key === tab.key);
                  setSwipeDirection(toIdx > fromIdx ? 1 : -1);
                  setActiveTab(tab.key);
                }}
                className={`flex-1 px-1.5 py-2.5 text-sm font-medium transition-colors min-w-0 ${
                  isActive ? 'text-white' : 'text-white/50'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate leading-none">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Swipeable tab content ── */}
        <div
          className="w-full overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
            <motion.div
              key={activeTab}
              custom={swipeDirection}
              initial={{ x: swipeDirection * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: swipeDirection * -60, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full flex flex-col items-center gap-5"
            >
              {/* ── PROFIL TAB ── */}
              {activeTab === 'profil' && (
                <CandidateSlideProfileTab
                  application={application}
                  rating={rating}
                  profileImageUrl={profileImageUrl}
                  videoUrl={videoUrl}
                  signedCvUrl={signedCvUrl}
                  isProfileVideo={!!isProfileVideo}
                  initials={initials}
                  summaryHook={summaryHook}
                  onOpenFullProfile={onOpenFullProfile}
                />
              )}

              {/* ── AKTIVITET TAB ── */}
              {activeTab === 'aktivitet' && (
                <div className="w-full">
                  <SectionErrorBoundary fallbackLabel="Aktivitetslogg">
                    <CandidateActivityLog applicantId={application.applicant_id} />
                  </SectionErrorBoundary>
                </div>
              )}

              {/* ── ANTECKNINGAR TAB ── */}
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

        {/* Separator / next hint */}
        {!isLast && (
          <div className="w-full pt-6 pb-2">
            <div className="w-full h-px bg-white/10" />
            <div className="flex flex-col items-center gap-1 pt-4">
              <ChevronDown className="h-4 w-4 text-white fill-white animate-bounce" />
              <span className="text-[10px] text-white font-medium">Nästa kandidat</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
