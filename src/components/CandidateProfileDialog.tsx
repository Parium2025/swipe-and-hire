import { Dialog, DialogHeader, DialogTitle, DialogDescription, dialogCloseButtonClassName, dialogCloseIconClassName } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Briefcase, User, Activity, StickyNote, ChevronDown, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { ShareCandidateDialog } from '@/components/ShareCandidateDialog';
import { SendMessageDialog } from '@/components/SendMessageDialog';
import type { StageSettings } from '@/hooks/useStageSettings';
import { BookInterviewDialog } from '@/components/BookInterviewDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useOutreachManualActions } from '@/hooks/useOutreachManualActions';
import { CvViewer } from '@/components/CvViewer';
import { CandidateActivityLog } from '@/components/CandidateActivityLog';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useFieldDraft } from '@/hooks/useFormDraft';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { formatTimeAgo } from '@/lib/date';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CandidateNotesPanel,
  SectionErrorBoundary,
  InteractiveStarRating,
  ProfileInfoSections,
  ProfileActions,
  DeleteNoteDialog,
  RemoveCandidateDialog,
  questionsCache,
  getPersistedCacheValue,
  setPersistedCacheValue,
  QUESTIONS_STORAGE_KEY,
} from '@/components/candidateProfile';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { ManualOutreachActionKey } from '@/lib/outreachManualActions';

function useProfileImageUrl(path: string | null | undefined) {
  return useMediaUrl(path, 'profile-image');
}

function useVideoUrl(path: string | null | undefined) {
  return useMediaUrl(path, 'profile-video');
}

interface CandidateProfileDialogProps {
  application: ApplicationData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: () => void;
  allApplications?: ApplicationData[];
  loadingApplications?: boolean;
  candidateRating?: number;
  onRatingChange?: (rating: number) => void;
  variant?: 'all-candidates' | 'my-candidates';
  currentStage?: string;
  stageOrder?: string[];
  stageConfig?: Record<string, StageSettings>;
  onStageChange?: (newStage: string) => void;
  onRemoveFromList?: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  candidateIndex?: number;
  candidateTotal?: number;
}

export const CandidateProfileDialog = ({
  application,
  open,
  onOpenChange,
  onStatusUpdate,
  allApplications,
  loadingApplications = false,
  candidateRating,
  onRatingChange,
  variant = 'my-candidates',
  currentStage,
  stageOrder,
  stageConfig,
  onStageChange,
  onRemoveFromList,
  onNavigatePrev,
  onNavigateNext,
  candidateIndex,
  candidateTotal,
}: CandidateProfileDialogProps) => {
  const { user } = useAuth();
  const { hasTeam } = useTeamMembers();
  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'activity' | 'comments'>('activity');
  const [mobileTab, setMobileTab] = useState<'profile' | 'activity' | 'comments'>('profile');
  const [newNote, setNewNote, clearNoteDraft] = useFieldDraft(
    `candidate-note-${application?.applicant_id || 'unknown'}`
  );
  const [bookInterviewOpen, setBookInterviewOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [sendMessagePreset, setSendMessagePreset] = useState<ManualOutreachActionKey | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [jobQuestions, setJobQuestions] = useState<Record<string, { text: string; order: number }>>(() => {
    if (!application?.job_id) return {};
    const cached = questionsCache.get(application.job_id);
    if (cached) return cached;
    const persisted = getPersistedCacheValue<Record<string, { text: string; order: number }>>(
      QUESTIONS_STORAGE_KEY,
      application.job_id
    );
    if (persisted) {
      questionsCache.set(application.job_id, persisted);
      return persisted;
    }
    return {};
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const previousRating = useRef<number | undefined>(undefined);
  const lastResetApplicationIdRef = useRef<string | null>(null);

  const activeApplication = useMemo(() => {
    if (!allApplications || allApplications.length <= 1) return application;
    if (!selectedJobId) return application;
    return allApplications.find(app => app.job_id === selectedJobId) || application;
  }, [allApplications, selectedJobId, application]);

  useLayoutEffect(() => {
    const jobId = activeApplication?.job_id;
    if (!jobId) {
      setJobQuestions({});
      return;
    }
    const cachedQ = questionsCache.get(jobId)
      || getPersistedCacheValue<Record<string, { text: string; order: number }>>(QUESTIONS_STORAGE_KEY, jobId);
    if (cachedQ) {
      questionsCache.set(jobId, cachedQ);
      setJobQuestions(cachedQ);
      return;
    }
    setJobQuestions({});
  }, [activeApplication?.job_id]);

  const profileImageUrl = useProfileImageUrl(activeApplication?.profile_image_url);
  const videoUrl = useVideoUrl(activeApplication?.video_url);
  const signedCvUrl = useMediaUrl(activeApplication?.cv_url, 'cv');

  const notesHook = useCandidateNotes({
    applicantId: activeApplication?.applicant_id || application?.applicant_id || null,
    jobId: activeApplication?.job_id || null,
  });

  const summaryHook = useCandidateSummary({
    applicantId: activeApplication?.applicant_id || null,
    jobId: activeApplication?.job_id || null,
    applicationId: activeApplication?.id || null,
    cvUrl: activeApplication?.cv_url || null,
    open,
  });
  const outreachManualActions = useOutreachManualActions(open);

  useEffect(() => {
    if (!application) return;
    if (lastResetApplicationIdRef.current === application.id) return;
    lastResetApplicationIdRef.current = application.id;
    setSelectedJobId(application.job_id);
    previousRating.current = candidateRating;
    setMobileTab('profile');
    setCvOpen(false);
    setJobDropdownOpen(false);
    const cachedQ = questionsCache.get(application.job_id)
      || getPersistedCacheValue<Record<string, { text: string; order: number }>>(QUESTIONS_STORAGE_KEY, application.job_id);
    if (cachedQ) {
      questionsCache.set(application.job_id, cachedQ);
      setJobQuestions(cachedQ);
    } else {
      setJobQuestions({});
    }
    notesHook.reset();
    summaryHook.reset();
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRatingChange = (newRating: number) => {
    if (onRatingChange && application) {
      previousRating.current = newRating;
      onRatingChange(newRating);
    }
  };

  const fetchJobQuestions = useCallback(async () => {
    if (!activeApplication?.job_id) return;
    const qCacheKey = activeApplication.job_id;
    const cachedQ = questionsCache.get(qCacheKey);
    if (cachedQ) { setJobQuestions(cachedQ); return; }
    const persistedQ = getPersistedCacheValue<Record<string, { text: string; order: number }>>(QUESTIONS_STORAGE_KEY, qCacheKey);
    if (persistedQ) { questionsCache.set(qCacheKey, persistedQ); setJobQuestions(persistedQ); return; }
    try {
      const { data, error } = await supabase
        .from('job_questions')
        .select('id, question_text, order_index')
        .eq('job_id', activeApplication.job_id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      const questionsMap: Record<string, { text: string; order: number }> = {};
      data?.forEach(q => { questionsMap[q.id] = { text: q.question_text, order: q.order_index }; });
      questionsCache.set(qCacheKey, questionsMap);
      setPersistedCacheValue(QUESTIONS_STORAGE_KEY, qCacheKey, questionsMap);
      setJobQuestions(questionsMap);
    } catch (error) {
      console.error('Error fetching job questions:', error);
    }
  }, [activeApplication?.job_id]);

  useEffect(() => {
    if (open && activeApplication && user) {
      notesHook.fetchNotes();
      fetchJobQuestions();
    }
  }, [open, activeApplication?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'ArrowLeft' && onNavigatePrev) { e.preventDefault(); onNavigatePrev(); }
      else if (e.key === 'ArrowRight' && onNavigateNext) { e.preventDefault(); onNavigateNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onNavigatePrev, onNavigateNext]);

  if (!application) return null;

  const displayApp = activeApplication || application;
  const initials = `${displayApp.first_name?.[0] || ''}${displayApp.last_name?.[0] || ''}`.toUpperCase();
  const isProfileVideo = displayApp.is_profile_video && displayApp.video_url;
  const hasMultipleApplications = !!allApplications && allApplications.length > 1;
  const showJobSelectorShell = loadingApplications || hasMultipleApplications;

  const notesPanelProps = {
    notes: notesHook.notes,
    loadingNotes: notesHook.loadingNotes,
    newNote,
    onNewNoteChange: setNewNote,
    onSaveNote: () => notesHook.saveNote(newNote, () => { setNewNote(''); clearNoteDraft(); }),
    savingNote: notesHook.savingNote,
    currentUserId: user?.id,
    onStartEditing: notesHook.startEditing,
    onConfirmDelete: (noteId: string) => notesHook.setDeletingNoteId(noteId),
    editingNoteId: notesHook.editingNoteId,
    editingNoteText: notesHook.editingNoteText,
    originalNoteText: notesHook.originalNoteText,
    onEditingNoteTextChange: notesHook.setEditingNoteText,
    onUpdateNote: notesHook.updateNote,
    onCancelEditing: notesHook.cancelEditing,
  };

  const candidateName = `${displayApp.first_name || ''} ${displayApp.last_name || ''}`.trim() || 'Kandidat';
  const quickActions = [
    outreachManualActions.hasAction('progress')
      ? {
          key: 'progress' as const,
          label: 'Gå vidare',
          variant: outreachManualActions.groups.progress.action.buttonVariant,
          onClick: () => {
            setSendMessagePreset('progress');
            setSendMessageOpen(true);
          },
        }
      : null,
    outreachManualActions.hasAction('rejection')
      ? {
          key: 'rejection' as const,
          label: 'Avslag',
          variant: outreachManualActions.groups.rejection.action.buttonVariant,
          onClick: () => {
            setSendMessagePreset('rejection');
            setSendMessageOpen(true);
          },
        }
      : null,
  ].filter(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus hideClose className="max-w-[950px] md:max-h-[85vh] overflow-hidden bg-card-parium backdrop-blur-md border-white/20 text-white p-0 !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 md:!right-auto md:!bottom-auto md:!left-[50%] md:!top-[50%] md:!translate-x-[-50%] md:!translate-y-[-50%] w-screen h-[100dvh] md:w-[min(950px,calc(100vw-3rem))] md:h-auto md:rounded-lg rounded-none border-0 md:border flex flex-col data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] duration-300">
        <DialogHeader className="sr-only">
          <DialogTitle>Kandidatprofil: {displayApp.first_name} {displayApp.last_name}</DialogTitle>
          <DialogDescription>Visa kandidatens profilinformation och ansökan</DialogDescription>
        </DialogHeader>

        {/* Mobile tabs header */}
        <MobileProfileTabs mobileTab={mobileTab} setMobileTab={setMobileTab} />
          <button
            style={{ visibility: cvOpen ? 'hidden' : 'visible' }}
            onClick={() => onOpenChange(false)}
            aria-label="Stäng"
            className={cn(dialogCloseButtonClassName, 'static')}
          >
            <X className={dialogCloseIconClassName} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 min-w-0 overflow-x-hidden md:max-h-[85vh]">
          {/* Main content - left side */}
          <div className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pt-2 md:p-5 space-y-4 [overflow-wrap:anywhere] [&_a]:break-all [&_p]:break-words [&_span]:break-words ${mobileTab !== 'profile' ? 'hidden md:block' : ''}`} onScroll={() => jobDropdownOpen && setJobDropdownOpen(false)}>

          {/* Candidate navigation bar */}
          {candidateTotal != null && candidateTotal >= 1 && (
            <div className="flex items-center justify-center gap-3 py-1">
              <button onClick={onNavigatePrev} disabled={!onNavigatePrev} className="flex items-center justify-center h-7 w-7 rounded-full text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-default disabled:hover:bg-transparent" aria-label="Föregående kandidat">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-white font-medium tabular-nums">
                {(candidateIndex ?? 0) + 1} av {candidateTotal}
              </span>
              <button onClick={onNavigateNext} disabled={!onNavigateNext} className="flex items-center justify-center h-7 w-7 rounded-full text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-default disabled:hover:bg-transparent" aria-label="Nästa kandidat">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Header with circular profile image/video */}
          <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
            <div className="relative">
              {isProfileVideo && videoUrl ? (
                <div className="w-24 h-24 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
                  <ProfileVideo videoUrl={videoUrl} coverImageUrl={profileImageUrl || undefined} userInitials={initials} className="w-full h-full" showCountdown={true} showProgressBar={false} />
                </div>
              ) : (
                <Avatar className="w-24 h-24 md:w-48 md:h-48 border-4 border-white/20 shadow-xl">
                  <AvatarImage src={profileImageUrl || ''} alt={`${displayApp.first_name} ${displayApp.last_name}`} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-white text-2xl md:text-5xl font-semibold" delayMs={200}>{initials}</AvatarFallback>
                </Avatar>
              )}
            </div>

            <div className="w-full min-w-0">
              <h2 className="text-lg md:text-2xl font-semibold text-white text-center break-words [overflow-wrap:anywhere]">
                {displayApp.first_name} {displayApp.last_name}
              </h2>

              {onRatingChange && (
                <div className="mt-2">
                  <InteractiveStarRating rating={candidateRating} onChange={handleRatingChange} />
                </div>
              )}

              {showJobSelectorShell ? (
                <div className="mt-2 relative w-full min-w-0">
                  <TooltipProvider delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => hasMultipleApplications && setJobDropdownOpen(prev => !prev)}
                          className="w-full min-w-0 flex items-center justify-between gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white hover:bg-white/20 transition-colors"
                        >
                          <span className="truncate flex-1 min-w-0 text-left">{displayApp.job_title || application?.job_title || 'Okänt jobb'}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-white">
                              {allApplications ? `${allApplications.length} jobb` : '1 jobb'}
                            </span>
                            {hasMultipleApplications ? (
                              <ChevronDown className={`h-4 w-4 text-white transition-transform ${jobDropdownOpen ? 'rotate-180' : ''}`} />
                            ) : (
                              <Briefcase className="h-4 w-4 text-white/60" />
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[min(90vw,28rem)] whitespace-normal break-words leading-snug">
                        {displayApp.job_title || application?.job_title || 'Okänt jobb'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {hasMultipleApplications && jobDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setJobDropdownOpen(false)} />
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-[calc(100%+1rem)] max-w-sm rounded-lg border border-white/20 bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="max-h-60 overflow-y-auto overscroll-contain">
                        {allApplications!.map((app) => {
                          const isActive = (selectedJobId || displayApp.job_id) === app.job_id;
                          return (
                            <button
                              key={app.job_id}
                              type="button"
                              onClick={() => {
                                const cachedQ = questionsCache.get(app.job_id)
                                  || getPersistedCacheValue<Record<string, { text: string; order: number }>>(QUESTIONS_STORAGE_KEY, app.job_id)
                                  || {};
                                if (Object.keys(cachedQ).length > 0) questionsCache.set(app.job_id, cachedQ);
                                setJobQuestions(cachedQ);
                                setSelectedJobId(app.job_id);
                                setJobDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors min-h-touch ${
                                isActive ? 'bg-white/15' : 'hover:bg-white/10 '
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white leading-snug break-words">{app.job_title || 'Okänt jobb'}</p>
                                <p className="text-xs text-white mt-0.5">Sökte {formatTimeAgo(app.applied_at)}</p>
                              </div>
                              {isActive && <Check className="h-4 w-4 text-white shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-2 w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5">
                  <p className="text-sm text-white break-words">{displayApp.job_title}</p>
                </div>
              )}
            </div>
          </div>

          {/* Info sections (contact, employment, Q&A, summary, CV, bio) */}
          <ProfileInfoSections
            displayApp={displayApp}
            jobQuestions={jobQuestions}
            questionsExpanded={questionsExpanded}
            onToggleQuestions={() => setQuestionsExpanded(prev => !prev)}
            summaryHook={summaryHook}
            signedCvUrl={signedCvUrl}
            onOpenCv={() => setCvOpen(true)}
          />

          {/* Actions */}
          <ProfileActions
            variant={variant}
            hasTeam={hasTeam}
            onSendMessage={() => {
              setSendMessagePreset(null);
              setSendMessageOpen(true);
            }}
            onBookInterview={() => setBookInterviewOpen(true)}
            onShare={() => setShareDialogOpen(true)}
            onRemove={() => setRemoveConfirmOpen(true)}
            currentStage={currentStage}
            stageOrder={stageOrder}
            stageConfig={stageConfig}
            onStageChange={onStageChange}
            quickActions={quickActions}
          />
          </div>

          {/* Activity Sidebar - desktop only */}
          <div className="hidden md:flex w-80 border-l border-white/20 bg-white/5 flex-col overflow-hidden relative">
            <div className="relative flex border-b border-white/20 pr-10">
              <motion.div
                className="absolute bottom-0 h-0.5 bg-white"
                initial={false}
                animate={{
                  left: sidebarTab === 'activity' ? '0%' : `calc(50% - 20px)`,
                  width: `calc(50% - 20px)`,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 35, mass: 0.8 }}
              />
              <button
                onClick={() => setSidebarTab('activity')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === 'activity' ? 'text-white' : 'text-white/50 hover:text-white/70'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Aktivitet
                </div>
              </button>
              <button
                onClick={() => setSidebarTab('comments')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === 'comments' ? 'text-white' : 'text-white/50 hover:text-white/70'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5" />
                  Anteckningar
                </div>
              </button>
              <button
                style={{ visibility: cvOpen ? 'hidden' : 'visible' }}
                onClick={() => onOpenChange(false)}
                aria-label="Stäng"
                className={cn(dialogCloseButtonClassName, 'right-2 top-1/2 -translate-y-1/2 touch-manipulation')}
              >
                <X className={dialogCloseIconClassName} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <SectionErrorBoundary fallbackLabel={sidebarTab === 'activity' ? 'Aktivitetslogg' : 'Anteckningar'}>
                {sidebarTab === 'activity' ? (
                  <CandidateActivityLog applicantId={application?.applicant_id || null} />
                ) : (
                  <CandidateNotesPanel {...notesPanelProps} />
                )}
              </SectionErrorBoundary>
            </div>
          </div>

          {/* Mobile Activity/Comments tab content */}
          {mobileTab === 'activity' && (
            <div className="md:hidden flex-1 overflow-y-auto overflow-x-hidden p-4">
              <SectionErrorBoundary fallbackLabel="Aktivitetslogg">
                <CandidateActivityLog applicantId={application?.applicant_id || null} />
              </SectionErrorBoundary>
            </div>
          )}
          {mobileTab === 'comments' && (
            <div className="md:hidden flex-1 overflow-y-auto overflow-x-hidden p-4">
              <SectionErrorBoundary fallbackLabel="Anteckningar">
                <CandidateNotesPanel {...notesPanelProps} />
              </SectionErrorBoundary>
            </div>
          )}
        </div>
      </DialogContentNoFocus>
    </Dialog>

    {/* CV Dialog */}
    <Dialog open={cvOpen} onOpenChange={setCvOpen}>
      <DialogContentNoFocus hideClose className="max-w-4xl overflow-hidden bg-transparent border-none shadow-none p-2 md:p-8 w-screen h-[100dvh] md:w-auto md:h-auto md:max-h-[90vh] !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 md:!right-auto md:!bottom-auto md:!left-[50%] md:!top-[50%] md:!translate-x-[-50%] md:!translate-y-[-50%] rounded-none md:rounded-lg">
        <DialogHeader className="mb-2 md:mb-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-white text-lg md:text-2xl">CV</DialogTitle>
          <button type="button" onClick={() => setCvOpen(false)} className={cn(dialogCloseButtonClassName, 'static touch-manipulation')} aria-label="Stäng">
            <X className={dialogCloseIconClassName} />
          </button>
        </DialogHeader>
        {displayApp?.cv_url && signedCvUrl && (
          <CvViewer src={signedCvUrl} fileName="cv.pdf" height="calc(100dvh - 80px)" onClose={() => setCvOpen(false)} />
        )}
      </DialogContentNoFocus>
    </Dialog>

    {/* Delete note confirmation */}
    <DeleteNoteDialog
      open={!!notesHook.deletingNoteId}
      onOpenChange={(open) => !open && notesHook.setDeletingNoteId(null)}
      onConfirm={() => notesHook.deletingNoteId && notesHook.deleteNote(notesHook.deletingNoteId)}
    />

    {/* Book Interview Dialog */}
    {displayApp && (
      <BookInterviewDialog
        open={bookInterviewOpen}
        onOpenChange={setBookInterviewOpen}
        candidateName={candidateName}
        candidateId={displayApp.applicant_id}
        applicationId={displayApp.id}
        jobId={displayApp.job_id}
        jobTitle={displayApp.job_title || 'Tjänst'}
      />
    )}

    {/* Send Message Dialog */}
    {displayApp && (
      <SendMessageDialog
        open={sendMessageOpen}
        onOpenChange={(nextOpen) => {
          setSendMessageOpen(nextOpen);
          if (!nextOpen) setSendMessagePreset(null);
        }}
        recipientId={displayApp.applicant_id}
        recipientName={candidateName}
        jobId={displayApp.job_id}
        applicationId={displayApp.id}
        presetAction={sendMessagePreset}
      />
    )}

    {/* Share Candidate Dialog */}
    {displayApp && (
      <ShareCandidateDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        applicantId={displayApp.applicant_id}
        applicationId={displayApp.id}
        jobId={displayApp.job_id}
        candidateName={candidateName}
      />
    )}

    {/* Remove from list confirmation */}
    <RemoveCandidateDialog
      open={removeConfirmOpen}
      onOpenChange={setRemoveConfirmOpen}
      candidateName={`${displayApp?.first_name} ${displayApp?.last_name}`}
      onConfirm={() => {
        if (onRemoveFromList) {
          onRemoveFromList();
          onOpenChange(false);
        }
      }}
    />
    </>
  );
};

export default CandidateProfileDialog;
