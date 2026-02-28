import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Mail, Phone, MapPin, Briefcase, Calendar, FileText, User, ChevronDown, ChevronUp, StickyNote, Trash2, ExternalLink, Star, Activity, Loader2, CalendarPlus, ChevronLeft, ChevronRight, MessageSquare, Users, AlertTriangle, X, Check } from 'lucide-react';
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
import { CvViewer } from '@/components/CvViewer';
import { CandidateActivityLog } from '@/components/CandidateActivityLog';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useFieldDraft } from '@/hooks/useFormDraft';
import { useCandidateNotes } from '@/hooks/useCandidateNotes';
import { useCandidateSummary } from '@/hooks/useCandidateSummary';
import { formatTimeAgo } from '@/lib/date';
import {
  CandidateNotesPanel,
  CandidateSummarySection,
  SectionErrorBoundary,
  questionsCache,
  getPersistedCacheValue,
  setPersistedCacheValue,
  QUESTIONS_STORAGE_KEY,
} from '@/components/candidateProfile';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

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
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

// Interactive Star Rating component
const InteractiveStarRating = ({
  rating = 0, 
  maxStars = 5, 
  onChange 
}: { 
  rating?: number; 
  maxStars?: number; 
  onChange?: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  
  const handleClick = (e: React.MouseEvent, starIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (onChange) {
      const newRating = starIndex + 1 === rating ? 0 : starIndex + 1;
      onChange(newRating);
    }
  };
  
  const displayRating = hoverRating !== null ? hoverRating : rating;
  
  return (
    <div 
      className="flex gap-1 justify-center"
      onMouseLeave={() => setHoverRating(null)}
    >
      {Array.from({ length: maxStars }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => handleClick(e, i)}
          onMouseEnter={(e) => {
            e.stopPropagation();
            if (onChange) setHoverRating(i + 1);
          }}
          className="p-0.5 focus:outline-none transition-transform hover:scale-110"
        >
          <Star 
            className={`h-5 w-5 transition-colors ${
              i < displayRating 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-white/30 hover:text-yellow-400/50'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Employment status / availability label maps
const employmentStatusLabels: Record<string, string> = {
  tillsvidareanställning: 'Fast anställning',
  visstidsanställning: 'Visstidsanställning',
  provanställning: 'Provanställning',
  interim: 'Interim anställning',
  arbetssokande: 'Arbetssökande',
};

const workScheduleLabels: Record<string, string> = {
  heltid: 'Heltid',
  deltid: 'Deltid',
  timanställning: 'Timanställning',
};

const availabilityLabels: Record<string, string> = {
  omgaende: 'Omgående',
  'inom-1-manad': 'Inom 1 månad',
  'inom-3-manader': 'Inom 3 månader',
  'inom-6-manader': 'Inom 6 månader',
  'ej-aktuellt': 'Inte aktuellt just nu',
  osaker: 'Osäker',
};

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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  // Initialize questions from cache synchronously to avoid flicker
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

  // Determine the active application (selected job or default)
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

  // Get signed URLs for profile media
  const profileImageUrl = useProfileImageUrl(activeApplication?.profile_image_url);
  const videoUrl = useVideoUrl(activeApplication?.video_url);
  const signedCvUrl = useMediaUrl(activeApplication?.cv_url, 'cv');

  // ─── Extracted hooks ──────────────────────────────────────────────
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

  // Reset state only when an actual new application is selected (not on X close/reopen)
  useEffect(() => {
    if (!application) return;
    if (lastResetApplicationIdRef.current === application.id) return;

    lastResetApplicationIdRef.current = application.id;
    setSelectedJobId(application.job_id);
    previousRating.current = candidateRating;
    setMobileTab('profile');
    setCvOpen(false);
    setJobDropdownOpen(false);
    // Restore questions from cache synchronously to avoid flash
    const cachedQ = questionsCache.get(application.job_id)
      || getPersistedCacheValue<Record<string, { text: string; order: number }>>(QUESTIONS_STORAGE_KEY, application.job_id);
    if (cachedQ) {
      questionsCache.set(application.job_id, cachedQ);
      setJobQuestions(cachedQ);
    } else {
      setJobQuestions({});
    }
    // Reset extracted hooks only on application switch
    notesHook.reset();
    summaryHook.reset();
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle rating change with activity logging
  const handleRatingChange = (newRating: number) => {
    if (onRatingChange && application) {
      // Activity is logged inside the notes hook's parent — keep inline here for rating
      previousRating.current = newRating;
      onRatingChange(newRating);
    }
  };

  // ─── Fetch job questions ──────────────────────────────────────────

  const fetchJobQuestions = useCallback(async () => {
    if (!activeApplication?.job_id) return;
    
    const qCacheKey = activeApplication.job_id;
    const cachedQ = questionsCache.get(qCacheKey);
    if (cachedQ) {
      setJobQuestions(cachedQ);
      return;
    }

    const persistedQ = getPersistedCacheValue<Record<string, { text: string; order: number }>>(
      QUESTIONS_STORAGE_KEY,
      qCacheKey
    );
    if (persistedQ) {
      questionsCache.set(qCacheKey, persistedQ);
      setJobQuestions(persistedQ);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('job_questions')
        .select('id, question_text, order_index')
        .eq('job_id', activeApplication.job_id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      
      const questionsMap: Record<string, { text: string; order: number }> = {};
      data?.forEach(q => {
        questionsMap[q.id] = { text: q.question_text, order: q.order_index };
      });
      questionsCache.set(qCacheKey, questionsMap);
      setPersistedCacheValue(QUESTIONS_STORAGE_KEY, qCacheKey, questionsMap);
      setJobQuestions(questionsMap);
    } catch (error) {
      console.error('Error fetching job questions:', error);
    }
  }, [activeApplication?.job_id]);

  // Fetch notes and questions when dialog opens or job selection changes
  useEffect(() => {
    if (open && activeApplication && user) {
      notesHook.fetchNotes();
      fetchJobQuestions();
    }
  }, [open, activeApplication?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  
  if (!application) return null;

  const displayApp = activeApplication || application;
  const initials = `${displayApp.first_name?.[0] || ''}${displayApp.last_name?.[0] || ''}`.toUpperCase();
  const isProfileVideo = displayApp.is_profile_video && displayApp.video_url;

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from('job_applications')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', displayApp.id);

    if (error) {
      toast.error('Kunde inte uppdatera status');
    } else {
      toast.success('Status uppdaterad');
      onStatusUpdate();
    }
  };

  const customAnswers = displayApp.custom_answers || {};
  const customAnswerKeys = Object.keys(customAnswers);
  const hasCustomAnswers = customAnswerKeys.length > 0;
  const hasMultipleApplications = !!allApplications && allApplications.length > 1;
  const showJobSelectorShell = loadingApplications || hasMultipleApplications;
  const hasResolvedQuestions = hasCustomAnswers && customAnswerKeys.every((questionId) => !!jobQuestions[questionId]?.text);

  // Shared notes panel props
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus hideClose className="max-w-[950px] md:max-h-[85vh] overflow-hidden bg-card-parium backdrop-blur-md border-white/20 text-white p-0 !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 md:!right-auto md:!bottom-auto md:!left-[50%] md:!top-[50%] md:!translate-x-[-50%] md:!translate-y-[-50%] w-screen h-[100dvh] md:w-[min(950px,calc(100vw-3rem))] md:h-auto md:rounded-lg rounded-none border-0 md:border flex flex-col data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] duration-300">
        <DialogHeader className="sr-only">
          <DialogTitle>Kandidatprofil: {displayApp.first_name} {displayApp.last_name}</DialogTitle>
          <DialogDescription>Visa kandidatens profilinformation och ansökan</DialogDescription>
        </DialogHeader>
        
        {/* Mobile tabs header */}
        <div className="md:hidden flex shrink-0 items-center border-b border-white/20 relative">
          {/* Sliding indicator */}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-white"
            initial={false}
            animate={{
              left: `calc(${mobileTab === 'profile' ? 0 : mobileTab === 'activity' ? 1 : 2} * ((100% - 44px) / 3))`,
              width: `calc((100% - 44px) / 3)`,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 35, mass: 0.8 }}
          />
          {[
            { key: 'profile' as const, label: 'Profil', icon: User },
            { key: 'activity' as const, label: 'Aktivitet', icon: Activity },
            { key: 'comments' as const, label: 'Anteckningar', icon: StickyNote },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`flex-1 px-1.5 py-2 text-sm font-medium transition-colors min-w-0 ${
                mobileTab === tab.key
                  ? 'text-white'
                  : 'text-white/50'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 truncate">
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="truncate leading-none">{tab.label}</span>
              </div>
            </button>
          ))}
          <button
            style={{ visibility: cvOpen ? 'hidden' : 'visible' }}
            onClick={() => onOpenChange(false)}
            aria-label="Stäng"
            className="shrink-0 flex h-11 w-11 items-center justify-center transition-colors touch-manipulation"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <X className="h-6 w-6 text-white" />
            </div>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 md:max-h-[85vh]">
          {/* Main content - left side */}
          <div className={`flex-1 overflow-y-auto overscroll-contain p-4 pt-2 md:p-5 space-y-4 ${mobileTab !== 'profile' ? 'hidden md:block' : ''}`} onScroll={() => jobDropdownOpen && setJobDropdownOpen(false)}>
          {/* Header with circular profile image/video */}
          <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
            <div className="relative">
              {isProfileVideo && videoUrl ? (
                <div className="w-24 h-24 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
                  <ProfileVideo
                    videoUrl={videoUrl}
                    coverImageUrl={profileImageUrl || undefined}
                    userInitials={initials}
                    className="w-full h-full"
                    showCountdown={true}
                    showProgressBar={false}
                  />
                </div>
              ) : (
                <Avatar className="w-24 h-24 md:w-48 md:h-48 border-4 border-white/20 shadow-xl">
                  <AvatarImage 
                    src={profileImageUrl || ''} 
                    alt={`${displayApp.first_name} ${displayApp.last_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-white/10 text-white text-2xl md:text-5xl font-semibold" delayMs={200}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            
            <div className="w-full">
              <h2 className="text-lg md:text-2xl font-semibold text-white">
                {displayApp.first_name} {displayApp.last_name}
              </h2>
              
              {onRatingChange && (
                <div className="mt-2">
                  <InteractiveStarRating 
                    rating={candidateRating} 
                    onChange={handleRatingChange} 
                  />
                </div>
              )}
              
              {showJobSelectorShell ? (
                <div className="mt-2 relative w-full">
                  <TooltipProvider delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => hasMultipleApplications && setJobDropdownOpen(prev => !prev)}
                          className="w-full flex items-center justify-between gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white hover:bg-white/20 transition-colors"
                        >
                          <span className="truncate flex-1 text-left">{displayApp.job_title || application?.job_title || 'Okänt jobb'}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {loadingApplications ? (
                              <Loader2 className="h-4 w-4 text-white animate-spin" />
                            ) : (
                              <>
                                <span className="text-xs text-white">
                                  {`${allApplications!.length} jobb`}
                                </span>
                                {hasMultipleApplications ? (
                                  <ChevronDown className={`h-4 w-4 text-white transition-transform ${jobDropdownOpen ? 'rotate-180' : ''}`} />
                                ) : (
                                  <Briefcase className="h-4 w-4 text-white/60" />
                                )}
                              </>
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
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
                                if (Object.keys(cachedQ).length > 0) {
                                  questionsCache.set(app.job_id, cachedQ);
                                }
                                setJobQuestions(cachedQ);
                                setSelectedJobId(app.job_id);
                                setJobDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors min-h-touch ${
                                isActive ? 'bg-white/15' : 'hover:bg-white/10 active:bg-white/15'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white leading-snug break-words">
                                  {app.job_title || 'Okänt jobb'}
                                </p>
                                <p className="text-xs text-white mt-0.5">
                                  Sökte {formatTimeAgo(app.applied_at)}
                                </p>
                              </div>
                              {isActive && (
                                <Check className="h-4 w-4 text-white shrink-0 mt-0.5" />
                              )}
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

          {/* Info sections */}
          <div className="grid gap-2.5">
            {/* Information */}
            <div className="bg-white/10 border border-white/20 rounded-lg p-3">
              <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {displayApp.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-white shrink-0" />
                    <a href={`mailto:${displayApp.email}`} className="text-sm text-white hover:text-white/80 transition-colors truncate">
                      {displayApp.email}
                    </a>
                  </div>
                )}
                {displayApp.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-white shrink-0" />
                    <a href={`tel:${displayApp.phone}`} className="text-sm text-white hover:text-white/80 transition-colors">
                      {displayApp.phone}
                    </a>
                  </div>
                )}
                {displayApp.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-white shrink-0" />
                    <span className="text-sm text-white">{displayApp.location}</span>
                  </div>
                )}
                {displayApp.age && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-white shrink-0" />
                    <span className="text-sm text-white">{displayApp.age} år</span>
                  </div>
                )}
              </div>
            </div>

            {/* Anställningsinformation */}
            {(displayApp.employment_status || displayApp.work_schedule || displayApp.availability) && (
              <div className="bg-white/10 border border-white/20 rounded-lg p-3">
                <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" />
                  Anställningsinformation
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {displayApp.employment_status && (
                    <div>
                      <span className="text-sm text-white">Anställningsstatus?</span>
                      <p className="text-sm text-white">Svar: {employmentStatusLabels[displayApp.employment_status] || displayApp.employment_status}</p>
                    </div>
                  )}
                  {displayApp.work_schedule && (
                    <div>
                      <span className="text-sm text-white">Hur mycket jobbar du idag?</span>
                      <p className="text-sm text-white">Svar: {workScheduleLabels[displayApp.work_schedule] || displayApp.work_schedule}</p>
                    </div>
                  )}
                  {displayApp.availability && (
                    <div className="sm:col-span-2">
                      <span className="text-sm text-white">När kan du börja nytt jobb?</span>
                      <p className="text-sm text-white">Svar: {availabilityLabels[displayApp.availability] || displayApp.availability}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Questions & Answers - only show when questions are resolved (not raw UUIDs) */}
            {hasCustomAnswers && (
              <div className="bg-white/10 border border-white/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuestionsExpanded(!questionsExpanded)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider">
                    Frågor ({customAnswerKeys.length})
                  </h3>
                  {questionsExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-white" />
                  )}
                </button>

                {questionsExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {!hasResolvedQuestions ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                        <span className="text-sm text-white ml-2">Laddar frågor...</span>
                      </div>
                    ) : (
                      Object.entries(customAnswers)
                        .sort(([idA], [idB]) => {
                          const orderA = jobQuestions[idA]?.order ?? 999;
                          const orderB = jobQuestions[idB]?.order ?? 999;
                          return orderA - orderB;
                        })
                        .map(([questionId, answer]) => (
                        <div
                          key={questionId}
                          className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0"
                        >
                          <p className="text-sm text-white break-words">
                            {jobQuestions[questionId].text}
                          </p>
                          <p className="text-sm text-white break-words">
                            Svar: {String(answer) || <span className="opacity-50 italic">Inget svar</span>}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI Summary */}
            <SectionErrorBoundary fallbackLabel="AI-sammanfattning">
              <CandidateSummarySection
                aiSummary={summaryHook.aiSummary}
                loadingSummary={summaryHook.loadingSummary}
                generatingSummary={summaryHook.generatingSummary}
                hasCvUrl={!!activeApplication?.cv_url}
                signedCvUrl={signedCvUrl}
              />
            </SectionErrorBoundary>

            {/* CV Section */}
            {displayApp.cv_url && (
              <div className="bg-white/10 border border-white/20 rounded-lg p-3">
                <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  CV
                </h3>
                <div className={`w-full py-2 bg-white/5 border border-white/10 rounded-md flex items-center px-2.5 gap-2 ${!signedCvUrl ? 'opacity-50' : ''}`}>
                  <button
                    type="button"
                    onClick={() => signedCvUrl && setCvOpen(true)}
                    disabled={!signedCvUrl}
                    className="flex items-center gap-2 text-white transition-colors flex-1 disabled:cursor-wait"
                  >
                    {!signedCvUrl ? (
                      <Loader2 className="h-3.5 w-3.5 text-white shrink-0 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-white shrink-0" />
                    )}
                    <span className="text-sm">{signedCvUrl ? 'Visa CV' : 'Laddar CV...'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => signedCvUrl && setCvOpen(true)}
                    disabled={!signedCvUrl}
                    className="text-white hover:text-white/80 transition-colors disabled:cursor-wait"
                    title="Öppna CV"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Presentation */}
            <div className="bg-white/10 border border-white/20 rounded-lg p-3">
              <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Presentation om {displayApp.first_name || 'kandidaten'}
              </h3>
              {displayApp.bio ? (
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {displayApp.bio}
                </p>
              ) : (
                <p className="text-sm text-white">Ingen presentation angiven</p>
              )}
            </div>
          </div>

            {/* Actions */}
            {variant === 'my-candidates' ? (
              <div className="pt-4 border-t border-white/20 space-y-3">
                <div className="flex justify-center gap-1">
                  <Button onClick={() => setSendMessageOpen(true)} variant="glassPurple" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
                    <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
                    <span className="truncate">Meddelande</span>
                  </Button>
                  <Button onClick={() => setBookInterviewOpen(true)} variant="glassBlue" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
                    <CalendarPlus className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
                    <span className="truncate">Boka möte</span>
                  </Button>
                  {hasTeam && (
                    <Button onClick={() => setShareDialogOpen(true)} variant="glassAmber" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
                      <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
                      <span className="truncate">Dela</span>
                    </Button>
                  )}
                  <Button onClick={() => setRemoveConfirmOpen(true)} variant="glassRed" className="min-w-0 flex-1 h-8 px-2 text-[11px] md:h-9 md:px-3 md:text-sm">
                    <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1 shrink-0" />
                    <span className="truncate">Ta bort</span>
                  </Button>
                </div>

                {currentStage && stageOrder && stageConfig && onStageChange && stageOrder.length > 1 && (() => {
                  const currentIndex = stageOrder.indexOf(currentStage);
                  const prevStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : null;
                  const nextStage = currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
                  const prevLabel = prevStage ? stageConfig[prevStage]?.label || prevStage : null;
                  const nextLabel = nextStage ? stageConfig[nextStage]?.label || nextStage : null;
                  
                  return (
                    <div className="space-y-2">
                      <p className="text-center text-white text-xs font-medium">Flytta kandidat</p>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => prevStage && onStageChange(prevStage)}
                          disabled={!prevStage}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                            prevStage ? 'text-white bg-white/10 hover:bg-white/20' : 'opacity-40 text-white/50'
                          }`}
                        >
                          <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">Till {(prevLabel || 'föregående').replace('?', '')}</span>
                        </button>
                        <div className="flex-shrink-0 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium whitespace-nowrap">
                          {(stageConfig[currentStage]?.label || currentStage).replace('?', '')}
                        </div>
                        <button
                          onClick={() => nextStage && onStageChange(nextStage)}
                          disabled={!nextStage}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                            nextStage ? 'text-white bg-white/10 hover:bg-white/20' : 'opacity-40 text-white/50'
                          }`}
                        >
                          <span className="truncate">Till {(nextLabel || 'nästa').replace('?', '')}</span>
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="border-t border-white/15 pt-4 mt-4 flex justify-center gap-2">
                <Button onClick={() => setSendMessageOpen(true)} variant="glassPurple" size="default">
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Meddelande
                </Button>
                <Button onClick={() => setBookInterviewOpen(true)} variant="glassBlue" size="default">
                  <CalendarPlus className="h-4 w-4 mr-1.5" />
                  Boka möte
                </Button>
              </div>
            )}
          </div>

          {/* Activity Sidebar - desktop only */}
          <div className="hidden md:flex w-80 border-l border-white/20 bg-white/5 flex-col overflow-hidden relative">
            <div className="relative flex border-b border-white/20 pr-10">
              {/* Sliding indicator */}
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
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors touch-manipulation"
              >
                <X className="h-5 w-5 text-white" />
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
            <div className="md:hidden flex-1 overflow-y-auto p-4">
              <SectionErrorBoundary fallbackLabel="Aktivitetslogg">
                <CandidateActivityLog applicantId={application?.applicant_id || null} />
              </SectionErrorBoundary>
            </div>
          )}
          {mobileTab === 'comments' && (
            <div className="md:hidden flex-1 overflow-y-auto p-4">
              <SectionErrorBoundary fallbackLabel="Anteckningar">
                <CandidateNotesPanel {...notesPanelProps} />
              </SectionErrorBoundary>
            </div>
          )}
        </div>
      </DialogContentNoFocus>
    </Dialog>

    {/* CV Dialog — fullscreen on mobile, centered on desktop */}
    <Dialog open={cvOpen} onOpenChange={setCvOpen}>
      <DialogContentNoFocus hideClose className="max-w-4xl overflow-hidden bg-transparent border-none shadow-none p-2 md:p-8 w-screen h-[100dvh] md:w-auto md:h-auto md:max-h-[90vh] !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 md:!right-auto md:!bottom-auto md:!left-[50%] md:!top-[50%] md:!translate-x-[-50%] md:!translate-y-[-50%] rounded-none md:rounded-lg">
        <DialogHeader className="mb-2 md:mb-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-white text-lg md:text-2xl">CV</DialogTitle>
          <button
            type="button"
            onClick={() => setCvOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 touch-manipulation"
            aria-label="Stäng"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </DialogHeader>
        {displayApp?.cv_url && signedCvUrl && (
          <CvViewer 
            src={signedCvUrl} 
            fileName="cv.pdf" 
            height="calc(100dvh - 80px)"
            onClose={() => setCvOpen(false)}
          />
        )}
      </DialogContentNoFocus>
    </Dialog>

    {/* Delete note confirmation */}
    <AlertDialog open={!!notesHook.deletingNoteId} onOpenChange={(open) => !open && notesHook.setDeletingNoteId(null)}>
      <AlertDialogContentNoFocus 
        className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
      >
        <AlertDialogHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="bg-red-500/20 p-2 rounded-full">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
              Ta bort anteckning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-white text-sm leading-relaxed">
            Är du säker på att du vill ta bort denna anteckning? Denna åtgärd går inte att ångra.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
          <AlertDialogCancel 
            onClick={() => notesHook.setDeletingNoteId(null)}
            style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
            className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
          >
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => notesHook.deletingNoteId && notesHook.deleteNote(notesHook.deletingNoteId)}
            variant="destructiveSoft"
            style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
            className="flex-1 text-sm flex items-center justify-center rounded-full"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Ta bort
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContentNoFocus>
    </AlertDialog>

    {/* Book Interview Dialog */}
    {displayApp && (
      <BookInterviewDialog
        open={bookInterviewOpen}
        onOpenChange={setBookInterviewOpen}
        candidateName={`${displayApp.first_name || ''} ${displayApp.last_name || ''}`.trim() || 'Kandidat'}
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
        onOpenChange={setSendMessageOpen}
        recipientId={displayApp.applicant_id}
        recipientName={`${displayApp.first_name || ''} ${displayApp.last_name || ''}`.trim() || 'Kandidat'}
        jobId={displayApp.job_id}
        applicationId={displayApp.id}
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
        candidateName={`${displayApp.first_name || ''} ${displayApp.last_name || ''}`.trim() || 'Kandidat'}
      />
    )}

    {/* Remove from list confirmation */}
    <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
      <AlertDialogContentNoFocus 
        className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
      >
        <AlertDialogHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <div className="bg-red-500/20 p-2 rounded-full">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
              Ta bort kandidat
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-white text-sm leading-relaxed">
            Är du säker på att du vill ta bort{' '}
            <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">
              &quot;{displayApp?.first_name} {displayApp?.last_name}&quot;
            </span>
            ? Denna åtgärd går inte att ångra.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
          <AlertDialogCancel 
            onClick={() => setRemoveConfirmOpen(false)}
            style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
            className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
          >
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (onRemoveFromList) {
                onRemoveFromList();
                onOpenChange(false);
              }
            }}
            variant="destructiveSoft"
            style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
            className="flex-1 text-sm flex items-center justify-center rounded-full"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Ta bort
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContentNoFocus>
    </AlertDialog>
    </>
  );
};

export default CandidateProfileDialog;
