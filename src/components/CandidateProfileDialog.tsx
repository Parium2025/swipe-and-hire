import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Mail, Phone, MapPin, Briefcase, Calendar, FileText, User, ChevronDown, ChevronUp, StickyNote, Trash2, ExternalLink, Star, Activity, Loader2, CalendarPlus, ChevronLeft, ChevronRight, MessageSquare, Users, AlertTriangle, X } from 'lucide-react';
import { ShareCandidateDialog } from '@/components/ShareCandidateDialog';
import { SendMessageDialog } from '@/components/SendMessageDialog';
import type { StageSettings } from '@/hooks/useStageSettings';
import { BookInterviewDialog } from '@/components/BookInterviewDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CvViewer } from '@/components/CvViewer';
import { CandidateActivityLog } from '@/components/CandidateActivityLog';
import { useCandidateActivities } from '@/hooks/useCandidateActivities';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useFieldDraft } from '@/hooks/useFormDraft';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CandidateNotesPanel,
  CandidateSummarySection,
  summaryCache,
  questionsCache,
  notesCache,
  getPersistedCacheValue,
  setPersistedCacheValue,
  getPersistedNotes,
  setPersistedNotes,
  SUMMARY_STORAGE_KEY,
  QUESTIONS_STORAGE_KEY,
} from '@/components/candidateProfile';
import type { CandidateNote, CandidateSummaryCacheValue } from '@/components/candidateProfile';

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
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [newNote, setNewNote, clearNoteDraft] = useFieldDraft(
    `candidate-note-${application?.applicant_id || 'unknown'}`
  );
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [bookInterviewOpen, setBookInterviewOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [jobQuestions, setJobQuestions] = useState<Record<string, { text: string; order: number }>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const previousRating = useRef<number | undefined>(undefined);
  
  const [aiSummary, setAiSummary] = useState<CandidateSummaryCacheValue | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Activity logging
  const { logActivity, deleteNoteActivities } = useCandidateActivities(application?.applicant_id || null);

  // Determine the active application (selected job or default)
  const activeApplication = useMemo(() => {
    if (!allApplications || allApplications.length <= 1) return application;
    if (!selectedJobId) return application;
    return allApplications.find(app => app.job_id === selectedJobId) || application;
  }, [allApplications, selectedJobId, application]);
  
  // Get signed URLs for profile media
  const profileImageUrl = useProfileImageUrl(activeApplication?.profile_image_url);
  const videoUrl = useVideoUrl(activeApplication?.video_url);
  const signedCvUrl = useMediaUrl(activeApplication?.cv_url, 'cv');

  // Reset ALL state when dialog opens with a new candidate
  useEffect(() => {
    if (open && application) {
      setSelectedJobId(application.job_id);
      previousRating.current = candidateRating;
      setMobileTab('profile');
      // Clear previous candidate's data to prevent flash of wrong data
      setAiSummary(null);
      setLoadingSummary(false);
      setGeneratingSummary(false);
      setNotes([]);
      setJobQuestions({});
      setCvOpen(false);
      setEditingNoteId(null);
      setEditingNoteText('');
      setDeletingNoteId(null);
    }
  }, [open, application?.applicant_id]);

  // Handle rating change with activity logging
  const handleRatingChange = (newRating: number) => {
    if (onRatingChange && application) {
      logActivity.mutate({
        applicantId: application.applicant_id,
        activityType: 'rating_changed',
        oldValue: previousRating.current?.toString() || '0',
        newValue: newRating.toString(),
        metadata: { job_id: application.job_id },
      });
      previousRating.current = newRating;
      onRatingChange(newRating);
    }
  };

  // ─── Fetch notes ──────────────────────────────────────────────────

  const fetchNotes = useCallback(async (forceRefresh = false) => {
    if (!application || !user) return;
    
    const notesCacheKey = application.applicant_id;
    if (!forceRefresh) {
      // Check in-memory cache
      const cachedNotes = notesCache.get(notesCacheKey);
      if (cachedNotes) {
        setNotes(cachedNotes);
        return;
      }
      // Check localStorage cache
      const persisted = getPersistedNotes(notesCacheKey);
      if (persisted) {
        notesCache.set(notesCacheKey, persisted);
        setNotes(persisted);
        // Background refresh to stay current
        refreshNotesInBackground(notesCacheKey);
        return;
      }
    }
    
    setLoadingNotes(true);
    try {
      const fetchedNotes = await fetchNotesFromDb(application.applicant_id);
      notesCache.set(notesCacheKey, fetchedNotes);
      setPersistedNotes(notesCacheKey, fetchedNotes);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, [application?.applicant_id, user?.id]);

  const refreshNotesInBackground = useCallback(async (notesCacheKey: string) => {
    try {
      const fetchedNotes = await fetchNotesFromDb(notesCacheKey);
      notesCache.set(notesCacheKey, fetchedNotes);
      setPersistedNotes(notesCacheKey, fetchedNotes);
      setNotes(fetchedNotes);
    } catch {
      // Silently fail - we already have cached data
    }
  }, []);

  const fetchNotesFromDb = async (applicantId: string): Promise<CandidateNote[]> => {
    const { data, error } = await supabase
      .from('candidate_notes')
      .select(`
        id, 
        note, 
        created_at, 
        employer_id,
        profiles!candidate_notes_employer_id_fkey(first_name, last_name)
      `)
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map((note: any) => ({
      id: note.id,
      note: note.note,
      created_at: note.created_at,
      employer_id: note.employer_id,
      author_name: note.profiles 
        ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() || 'Okänd'
        : 'Okänd',
    }));
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

  // ─── AI Summary ───────────────────────────────────────────────────

  const extractSummaryMeta = (keyPoints: any[] | null | undefined) => {
    const docPoint = (keyPoints || []).find(
      (p: any) => typeof p?.text === 'string' && p.text.startsWith('Dokumenttyp:')
    );
    const documentType = typeof docPoint?.text === 'string'
      ? docPoint.text.replace('Dokumenttyp:', '').trim()
      : null;
    const isValidCv = documentType ? documentType.toLowerCase() === 'cv' : undefined;
    const sourceCvUrl = docPoint?.meta?.source_cv_url as string | undefined;
    return { documentType, isValidCv, sourceCvUrl };
  };

  const fetchAiSummary = useCallback(async () => {
    if (!activeApplication?.applicant_id) return;
    
    const cvCacheKey = activeApplication.cv_url || '__no-cv__';
    const cacheKey = `${activeApplication.applicant_id}_${activeApplication.job_id || 'no-job'}_${cvCacheKey}`;
    
    // Check in-memory cache
    const cached = summaryCache.get(cacheKey);
    if (cached) {
      setAiSummary(cached);
      return { shouldAutoGenerate: false };
    }

    // Check localStorage cache
    const persisted = getPersistedCacheValue<CandidateSummaryCacheValue>(SUMMARY_STORAGE_KEY, cacheKey);
    if (persisted) {
      summaryCache.set(cacheKey, persisted);
      setAiSummary(persisted);
      return { shouldAutoGenerate: false };
    }

    // No CV → stable fallback
    if (!activeApplication.cv_url) {
      const noCvSummary: CandidateSummaryCacheValue = {
        summary_text: 'Kandidaten har inte laddat upp något CV',
        key_points: null,
        document_type: null,
        is_valid_cv: false,
      };
      summaryCache.set(cacheKey, noCvSummary);
      setPersistedCacheValue(SUMMARY_STORAGE_KEY, cacheKey, noCvSummary);
      setAiSummary(noCvSummary);
      return { shouldAutoGenerate: false };
    }

    setLoadingSummary(true);

    try {
      let data: { summary_text: string; key_points: any[] | null } | null = null;
      
      if (activeApplication?.job_id) {
        const { data: jobSummary, error } = await supabase
          .from('candidate_summaries')
          .select('summary_text, key_points')
          .eq('job_id', activeApplication.job_id)
          .eq('applicant_id', activeApplication.applicant_id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (jobSummary) {
          data = {
            summary_text: jobSummary.summary_text,
            key_points: (jobSummary.key_points as any[] | null) || null
          };
        }
      }

      // Fallback to proactive profile summary
      if (!data) {
        const { data: profileSummary, error: profileError } = await supabase
          .from('profile_cv_summaries')
          .select('summary_text, key_points, is_valid_cv, document_type, cv_url')
          .eq('user_id', activeApplication.applicant_id)
          .maybeSingle();

        if (!profileError && profileSummary) {
          const currentCvUrl = activeApplication.cv_url || null;
          if (!currentCvUrl || profileSummary.cv_url === currentCvUrl) {
            const summaryData: CandidateSummaryCacheValue = {
              summary_text: profileSummary.summary_text || '',
              key_points: (profileSummary.key_points as any[] | null) || [],
              document_type: profileSummary.document_type,
              is_valid_cv: profileSummary.is_valid_cv,
            };
            summaryCache.set(cacheKey, summaryData);
            setPersistedCacheValue(SUMMARY_STORAGE_KEY, cacheKey, summaryData);
            setAiSummary(summaryData);
            return { shouldAutoGenerate: false };
          }
        }
      }

      if (!data) {
        setAiSummary(null);
        return { shouldAutoGenerate: true };
      }

      const keyPoints = (data.key_points as any[] | null) || null;
      const meta = extractSummaryMeta(keyPoints);

      const currentCvUrl = activeApplication.cv_url || null;
      const isStale = !!currentCvUrl && (!meta.sourceCvUrl || meta.sourceCvUrl !== currentCvUrl);

      if (isStale) {
        setAiSummary(null);
        return { shouldAutoGenerate: true };
      }

      let isValidCv = meta.isValidCv;
      let documentType = meta.documentType;

      if (typeof isValidCv !== 'boolean') {
        isValidCv = !data.summary_text.includes('Kan inte läsa av ett CV');
      }
      if (!documentType && data.summary_text.includes('Kan inte läsa av ett CV')) {
        const match = data.summary_text.match(/dokumentet är (.+?)\./);
        if (match) documentType = match[1];
      }

      const summaryResult: CandidateSummaryCacheValue = {
        summary_text: data.summary_text,
        key_points: keyPoints as any,
        document_type: documentType,
        is_valid_cv: isValidCv,
      };
      summaryCache.set(cacheKey, summaryResult);
      setPersistedCacheValue(SUMMARY_STORAGE_KEY, cacheKey, summaryResult);
      setAiSummary(summaryResult);

      return { shouldAutoGenerate: false };
    } catch (error) {
      console.error('Error fetching AI summary:', error);
      return { shouldAutoGenerate: false };
    } finally {
      setLoadingSummary(false);
    }
  }, [activeApplication?.applicant_id, activeApplication?.job_id, activeApplication?.cv_url]);

  const generateAiSummary = useCallback(async (silent = false) => {
    if (!activeApplication?.applicant_id) return;
    
    if (!navigator.onLine) {
      if (!silent) toast.error('Du måste vara online för att generera sammanfattning');
      return;
    }
    
    setGeneratingSummary(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-cv-summary', {
        body: {
          applicant_id: activeApplication.applicant_id,
          application_id: activeApplication.id,
          job_id: activeApplication.job_id,
          cv_url_override: activeApplication.cv_url,
        },
      });

      if (error) throw error;

      if (data?.error) {
        if (!silent) toast.error(data.error);
        return;
      }

      if (!silent) {
        if (data?.is_valid_cv === false) {
          toast.message('Dokumentet är inte ett CV');
        } else {
          toast.success('Sammanfattning genererad från CV');
        }
      }

      if (data?.summary) {
        const genResult: CandidateSummaryCacheValue = {
          summary_text: data.summary.summary_text,
          key_points: data.summary.key_points,
          document_type: data.document_type || data.summary.document_type || null,
          is_valid_cv: data.is_valid_cv,
        };
        const genCacheKey = `${activeApplication.applicant_id}_${activeApplication.job_id || 'no-job'}_${activeApplication.cv_url || '__no-cv__'}`;
        summaryCache.set(genCacheKey, genResult);
        setPersistedCacheValue(SUMMARY_STORAGE_KEY, genCacheKey, genResult);
        setAiSummary(genResult);
      }
    } catch (error) {
      console.error('Error generating CV summary:', error);
      if (!silent) toast.error('Kunde inte generera sammanfattning');
    } finally {
      setGeneratingSummary(false);
    }
  }, [activeApplication?.applicant_id, activeApplication?.id, activeApplication?.job_id, activeApplication?.cv_url]);

  // Fetch notes and questions when dialog opens or job selection changes
  useEffect(() => {
    if (open && activeApplication && user) {
      fetchNotes();
      fetchJobQuestions();
    }
  }, [open, activeApplication?.id, user?.id]);

  // Auto-generate summary when dialog opens
  useEffect(() => {
    const autoGenerateIfNeeded = async () => {
      if (!open || !activeApplication || !user) return;
      const result = await fetchAiSummary();
      if (result?.shouldAutoGenerate && activeApplication.cv_url) {
        generateAiSummary(true);
      }
    };
    autoGenerateIfNeeded();
  }, [open, activeApplication?.id, user?.id]);

  // Polling with exponential backoff (3s → 6s → 12s → ...) and max 10 attempts
  useEffect(() => {
    if (!open || !activeApplication || aiSummary || loadingSummary || generatingSummary) return;

    let attempt = 0;
    const MAX_ATTEMPTS = 10;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!navigator.onLine || !activeApplication.cv_url || attempt >= MAX_ATTEMPTS) return;
      attempt++;

      try {
        const { data } = await supabase
          .from('candidate_summaries')
          .select('summary_text, key_points')
          .eq('job_id', activeApplication.job_id)
          .eq('applicant_id', activeApplication.applicant_id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          await fetchAiSummary();
          return; // Stop polling — found data
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      // Exponential backoff: 3s, 6s, 12s, 24s...
      const delay = 3000 * Math.pow(2, attempt - 1);
      timeoutId = setTimeout(poll, delay);
    };

    timeoutId = setTimeout(poll, 3000);

    return () => clearTimeout(timeoutId);
  }, [open, activeApplication?.id, aiSummary, loadingSummary, generatingSummary]);

  // ─── Note CRUD ────────────────────────────────────────────────────

  const saveNote = async () => {
    if (!newNote.trim() || !application || !user) return;
    if (!navigator.onLine) {
      toast.error('Du måste vara online för att spara anteckningar');
      return;
    }
    
    // Optimistic update — show note immediately
    const optimisticNote: CandidateNote = {
      id: `temp-${Date.now()}`,
      note: newNote.trim(),
      created_at: new Date().toISOString(),
      employer_id: user.id,
      author_name: 'Du',
    };
    const previousNotes = [...notes];
    const optimisticNotes = [optimisticNote, ...notes];
    setNotes(optimisticNotes);
    notesCache.set(application.applicant_id, optimisticNotes);
    setPersistedNotes(application.applicant_id, optimisticNotes);

    const noteText = newNote.trim();
    setNewNote('');
    clearNoteDraft();
    setSavingNote(true);

    try {
      const { error } = await supabase
        .from('candidate_notes')
        .insert({
          employer_id: user.id,
          applicant_id: application.applicant_id,
          job_id: application.job_id,
          note: noteText
        });

      if (error) throw error;

      logActivity.mutate({
        applicantId: application.applicant_id,
        activityType: 'note_added',
        newValue: noteText.substring(0, 100),
        metadata: { job_id: application.job_id },
      });

      toast.success('Anteckning sparad');
      // Background refresh to get real ID from server
      fetchNotes(true);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Kunde inte spara anteckning');
      // Rollback optimistic update
      setNotes(previousNotes);
      notesCache.set(application.applicant_id, previousNotes);
      setPersistedNotes(application.applicant_id, previousNotes);
      setNewNote(noteText);
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!application) return;
    if (!navigator.onLine) {
      toast.error('Du måste vara online för att ta bort anteckningar');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('candidate_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      
      await deleteNoteActivities.mutateAsync({ applicantId: application.applicant_id });
      
      toast.success('Anteckning borttagen');
      const updatedNotes = notes.filter(n => n.id !== noteId);
      notesCache.set(application.applicant_id, updatedNotes);
      setPersistedNotes(application.applicant_id, updatedNotes);
      setNotes(updatedNotes);
      setDeletingNoteId(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Kunde inte ta bort anteckning');
    }
  };

  const startEditingNote = (note: CandidateNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const updateNote = async () => {
    if (!editingNoteId || !editingNoteText.trim() || !application) return;
    
    // Optimistic update — show edited note immediately
    const previousNotes = [...notes];
    const updatedNotes = notes.map(n => 
      n.id === editingNoteId ? { ...n, note: editingNoteText.trim() } : n
    );
    setNotes(updatedNotes);
    notesCache.set(application.applicant_id, updatedNotes);
    setPersistedNotes(application.applicant_id, updatedNotes);

    const noteText = editingNoteText.trim();
    const noteId = editingNoteId;
    setEditingNoteId(null);
    setEditingNoteText('');
    setSavingNote(true);

    try {
      const { error } = await supabase
        .from('candidate_notes')
        .update({ note: noteText })
        .eq('id', noteId);

      if (error) throw error;

      logActivity.mutate({
        applicantId: application.applicant_id,
        activityType: 'note_edited',
        newValue: noteText.substring(0, 100),
        metadata: { job_id: application.job_id },
      });

      toast.success('Anteckning uppdaterad');
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Kunde inte uppdatera anteckning');
      // Rollback optimistic update
      setNotes(previousNotes);
      notesCache.set(application.applicant_id, previousNotes);
      setPersistedNotes(application.applicant_id, previousNotes);
      setEditingNoteId(noteId);
      setEditingNoteText(noteText);
    } finally {
      setSavingNote(false);
    }
  };
  
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
  const hasCustomAnswers = Object.keys(customAnswers).length > 0;
  const hasMultipleApplications = allApplications && allApplications.length > 1;

  // Shared notes panel props
  const notesPanelProps = {
    notes,
    loadingNotes,
    newNote,
    onNewNoteChange: setNewNote,
    onSaveNote: saveNote,
    savingNote,
    currentUserId: user?.id,
    onStartEditing: startEditingNote,
    onConfirmDelete: (noteId: string) => setDeletingNoteId(noteId),
    editingNoteId,
    editingNoteText,
    onEditingNoteTextChange: setEditingNoteText,
    onUpdateNote: updateNote,
    onCancelEditing: cancelEditingNote,
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
        <div className="md:hidden flex shrink-0 items-center border-b border-white/20">
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
                  ? 'text-white border-b-2 border-white'
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
          <div className={`flex-1 overflow-y-auto overscroll-contain p-4 pt-2 md:p-5 space-y-4 ${mobileTab !== 'profile' ? 'hidden md:block' : ''}`}>
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
            
            <div className="w-full max-w-sm">
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
              
              {hasMultipleApplications ? (
                <div className="mt-2">
                  <Select 
                    value={selectedJobId || displayApp.job_id} 
                    onValueChange={setSelectedJobId}
                  >
                    <SelectTrigger className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                      <SelectValue placeholder="Välj jobbansökan" />
                    </SelectTrigger>
                    <SelectContent className="bg-card-parium border-white/20">
                      {allApplications!.map((app) => (
                        <SelectItem 
                          key={app.job_id} 
                          value={app.job_id}
                          className="text-white hover:bg-white/10 focus:bg-white/10"
                        >
                          {app.job_title || 'Okänt jobb'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-white mt-1">
                    ({allApplications!.length} jobbansökningar)
                  </p>
                </div>
              ) : (
                <p className="text-white mt-1">{displayApp.job_title}</p>
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

            {/* Questions & Answers */}
            {hasCustomAnswers && (
              <div className="bg-white/10 border border-white/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuestionsExpanded(!questionsExpanded)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider">
                    Frågor ({Object.keys(customAnswers).length})
                  </h3>
                  {questionsExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-white" />
                  )}
                </button>

                {questionsExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {Object.entries(customAnswers)
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
                        <p className="text-sm text-white">
                          {jobQuestions[questionId]?.text || questionId}
                        </p>
                        <p className="text-sm text-white">
                          Svar: {String(answer) || <span className="opacity-50 italic">Inget svar</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Summary */}
            <CandidateSummarySection
              aiSummary={aiSummary}
              loadingSummary={loadingSummary}
              generatingSummary={generatingSummary}
              hasCvUrl={!!activeApplication?.cv_url}
              signedCvUrl={signedCvUrl}
            />

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
              <button
                onClick={() => setSidebarTab('activity')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === 'activity' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/70'
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
                  sidebarTab === 'comments' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/70'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5" />
                  Anteckningar
                </div>
              </button>

              <button
                onClick={() => onOpenChange(false)}
                aria-label="Stäng"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors touch-manipulation"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {sidebarTab === 'activity' ? (
                <CandidateActivityLog applicantId={application?.applicant_id || null} />
              ) : (
                <CandidateNotesPanel {...notesPanelProps} />
              )}
            </div>
          </div>

          {/* Mobile Activity/Comments tab content */}
          {mobileTab === 'activity' && (
            <div className="md:hidden flex-1 overflow-y-auto p-4">
              <CandidateActivityLog applicantId={application?.applicant_id || null} />
            </div>
          )}
          {mobileTab === 'comments' && (
            <div className="md:hidden flex-1 overflow-y-auto p-4">
              <CandidateNotesPanel {...notesPanelProps} />
            </div>
          )}
        </div>
      </DialogContentNoFocus>
    </Dialog>

    {/* CV Dialog — fullscreen on mobile, centered on desktop */}
    <Dialog open={cvOpen} onOpenChange={setCvOpen}>
      <DialogContentNoFocus className="max-w-4xl overflow-hidden bg-transparent border-none shadow-none p-2 md:p-8 w-screen h-[100dvh] md:w-auto md:h-auto md:max-h-[90vh] !top-0 !left-0 !right-0 !bottom-0 !translate-x-0 !translate-y-0 md:!right-auto md:!bottom-auto md:!left-[50%] md:!top-[50%] md:!translate-x-[-50%] md:!translate-y-[-50%] rounded-none md:rounded-lg">
        <DialogHeader className="mb-2 md:mb-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-white text-lg md:text-2xl">CV</DialogTitle>
          <button
            type="button"
            onClick={() => setCvOpen(false)}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-full bg-white/10 touch-manipulation"
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
    <AlertDialog open={!!deletingNoteId} onOpenChange={(open) => !open && setDeletingNoteId(null)}>
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
            onClick={() => setDeletingNoteId(null)}
            style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
            className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
          >
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => deletingNoteId && deleteNote(deletingNoteId)}
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
              "{displayApp?.first_name} {displayApp?.last_name}"
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
