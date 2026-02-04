import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { Mail, Phone, MapPin, Briefcase, Calendar, FileText, User, Clock, ChevronDown, ChevronUp, StickyNote, Send, Trash2, ExternalLink, Star, Activity, Sparkles, Loader2, Pencil, X, Check, CalendarPlus, ChevronLeft, ChevronRight, MessageSquare, Users, UserMinus, AlertTriangle } from 'lucide-react';
import { ShareCandidateDialog } from '@/components/ShareCandidateDialog';
import { SendMessageDialog } from '@/components/SendMessageDialog';
import type { StageSettings } from '@/hooks/useStageSettings';
import { BookInterviewDialog } from '@/components/BookInterviewDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import ProfileVideo from '@/components/ProfileVideo';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

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
  /** All applications from the same candidate (for job dropdown) */
  allApplications?: ApplicationData[];
  /** Current rating for the candidate in my_candidates */
  candidateRating?: number;
  /** Callback when rating is changed */
  onRatingChange?: (rating: number) => void;
  /** Variant: 'all-candidates' shows only Book meeting button (sticky), 'my-candidates' shows all buttons */
  variant?: 'all-candidates' | 'my-candidates';
  /** Current stage of the candidate (for my-candidates variant) */
  currentStage?: string;
  /** Ordered list of stage keys */
  stageOrder?: string[];
  /** Stage configuration with labels/colors */
  stageConfig?: Record<string, StageSettings>;
  /** Callback when stage is changed */
  onStageChange?: (newStage: string) => void;
  /** Callback when candidate is removed from my candidates list */
  onRemoveFromList?: () => void;
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

interface CandidateNote {
  id: string;
  note: string;
  created_at: string;
  employer_id: string;
  author_name?: string;
}

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
      // If clicking the same rating, reset to 0
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
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  // Auto-save note draft to localStorage (unique per candidate)
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
  const [removing, setRemoving] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [jobQuestions, setJobQuestions] = useState<Record<string, { text: string; order: number }>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const previousRating = useRef<number | undefined>(undefined);
  
  // AI Summary state
  const [aiSummary, setAiSummary] = useState<{
    summary_text: string;
    key_points: { text: string; type?: 'positive' | 'negative' | 'neutral' }[] | null;
    document_type?: string | null;
    is_valid_cv?: boolean;
  } | null>(null);
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

  // Reset selected job and track rating when dialog opens with new application
  useEffect(() => {
    if (open && application) {
      setSelectedJobId(application.job_id);
      previousRating.current = candidateRating;
    }
  }, [open, application?.applicant_id]);

  // Handle rating change with activity logging
  const handleRatingChange = (newRating: number) => {
    if (onRatingChange && application) {
      // Log the activity
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

  // Fetch notes, questions, and AI summary when dialog opens or job selection changes
  useEffect(() => {
    if (open && activeApplication && user) {
      fetchNotes();
      fetchJobQuestions();
      fetchAiSummary();
    }
  }, [open, activeApplication?.id, user?.id]);

  // Helpers: parse stored summary JSON into UI state + meta
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

  // Fetch AI summary for this candidate/job combination
  const fetchAiSummary = async () => {
    if (!activeApplication?.applicant_id) return;
    setLoadingSummary(true);

    try {
      // First try job-specific summary
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

      // If no job-specific summary, try proactive profile summary as fallback
      if (!data) {
        const { data: profileSummary, error: profileError } = await supabase
          .from('profile_cv_summaries')
          .select('summary_text, key_points, is_valid_cv, document_type, cv_url')
          .eq('user_id', activeApplication.applicant_id)
          .maybeSingle();

        if (!profileError && profileSummary) {
          // Check if the proactive summary matches current CV
          const currentCvUrl = activeApplication.cv_url || null;
          if (!currentCvUrl || profileSummary.cv_url === currentCvUrl) {
            setAiSummary({
              summary_text: profileSummary.summary_text || '',
              key_points: (profileSummary.key_points as any[] | null) || [],
              document_type: profileSummary.document_type,
              is_valid_cv: profileSummary.is_valid_cv,
            });
            return { shouldAutoGenerate: false };
          }
        }
      }

      // No existing summary - trigger generation
      if (!data) {
        setAiSummary(null);
        return { shouldAutoGenerate: true };
      }

      const keyPoints = (data.key_points as any[] | null) || null;
      const meta = extractSummaryMeta(keyPoints);

      // If we have a current CV file but the stored summary is missing meta,
      // or was generated for a different uploaded document, treat as stale and regenerate.
      const currentCvUrl = activeApplication.cv_url || null;
      const isStale = !!currentCvUrl && (!meta.sourceCvUrl || meta.sourceCvUrl !== currentCvUrl);

      if (isStale) {
        setAiSummary(null);
        return { shouldAutoGenerate: true };
      }

      // Determine CV validity:
      // - Prefer explicit doc type from key points
      // - Fallback to legacy string check
      let isValidCv = meta.isValidCv;
      let documentType = meta.documentType;

      if (typeof isValidCv !== 'boolean') {
        isValidCv = !data.summary_text.includes('Kan inte läsa av ett CV');
      }
      if (!documentType && data.summary_text.includes('Kan inte läsa av ett CV')) {
        const match = data.summary_text.match(/dokumentet är (.+?)\./);
        if (match) documentType = match[1];
      }

      setAiSummary({
        summary_text: data.summary_text,
        key_points: keyPoints as any,
        document_type: documentType,
        is_valid_cv: isValidCv,
      });

      return { shouldAutoGenerate: false };
    } catch (error) {
      console.error('Error fetching AI summary:', error);
      return { shouldAutoGenerate: false };
    } finally {
      setLoadingSummary(false);
    }
  };

  // Generate AI summary on-demand - based ONLY on the uploaded document
  const generateAiSummary = async (silent = false) => {
    if (!activeApplication?.applicant_id) return;
    
    // Check if online before generating
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
        setAiSummary({
          summary_text: data.summary.summary_text,
          key_points: data.summary.key_points,
          document_type: data.document_type || data.summary.document_type || null,
          is_valid_cv: data.is_valid_cv,
        });
      }
    } catch (error) {
      console.error('Error generating CV summary:', error);
      if (!silent) toast.error('Kunde inte generera sammanfattning');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Auto-generate summary when dialog opens and no summary exists
  useEffect(() => {
    const autoGenerateIfNeeded = async () => {
      if (!open || !activeApplication || !user) return;
      
      // Check if summary already exists
      const result = await fetchAiSummary();
      
      // Auto-generate if no summary and CV exists
      if (result?.shouldAutoGenerate && activeApplication.cv_url) {
        generateAiSummary(true); // Silent mode - no toast
      }
    };
    
    autoGenerateIfNeeded();
  }, [open, activeApplication?.id, user?.id]);

  // Polling: Check for summary updates every 3 seconds if no summary exists
  useEffect(() => {
    if (!open || !activeApplication || aiSummary || loadingSummary) return;

    const pollInterval = setInterval(async () => {
      // Skip polling if offline
      if (!navigator.onLine || !activeApplication.cv_url) return;

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
          // Reuse the main fetch parser logic by calling fetchAiSummary (which also handles staleness)
          await fetchAiSummary();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [open, activeApplication?.id, aiSummary, loadingSummary]);

  // Fetch notes and questions when dialog opens
  useEffect(() => {
    if (open && activeApplication && user) {
      fetchNotes();
      fetchJobQuestions();
    }
  }, [open, activeApplication?.id, user?.id]);

  const fetchJobQuestions = async () => {
    if (!activeApplication?.job_id) return;
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
      setJobQuestions(questionsMap);
    } catch (error) {
      console.error('Error fetching job questions:', error);
    }
  };

  const fetchNotes = async () => {
    if (!application || !user) return;
    setLoadingNotes(true);
    try {
      // Fetch notes with author profile info
      const { data, error } = await supabase
        .from('candidate_notes')
        .select(`
          id, 
          note, 
          created_at, 
          employer_id,
          profiles!candidate_notes_employer_id_fkey(first_name, last_name)
        `)
        .eq('applicant_id', application.applicant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to include author name
      const notesWithAuthor = (data || []).map((note: any) => ({
        id: note.id,
        note: note.note,
        created_at: note.created_at,
        employer_id: note.employer_id,
        author_name: note.profiles 
          ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() || 'Okänd'
          : 'Okänd',
      }));
      
      setNotes(notesWithAuthor);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const saveNote = async () => {
    if (!newNote.trim() || !application || !user) return;
    
    // Check if online before saving
    if (!navigator.onLine) {
      toast.error('Du måste vara online för att spara anteckningar');
      return;
    }
    
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('candidate_notes')
        .insert({
          employer_id: user.id,
          applicant_id: application.applicant_id,
          job_id: application.job_id,
          note: newNote.trim()
        });

      if (error) throw error;

      // Log activity
      logActivity.mutate({
        applicantId: application.applicant_id,
        activityType: 'note_added',
        newValue: newNote.trim().substring(0, 100), // Store preview of note
        metadata: { job_id: application.job_id },
      });

      toast.success('Anteckning sparad');
      setNewNote('');
      clearNoteDraft(); // Rensa sparad draft efter lyckad sparning
      fetchNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Kunde inte spara anteckning');
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!application) return;
    
    // Check if online before deleting
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
      
      // Also delete related note activities
      await deleteNoteActivities.mutateAsync({ applicantId: application.applicant_id });
      
      toast.success('Anteckning borttagen');
      setNotes(notes.filter(n => n.id !== noteId));
      setDeletingNoteId(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Kunde inte ta bort anteckning');
    }
  };

  const confirmDeleteNote = (noteId: string) => {
    setDeletingNoteId(noteId);
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
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('candidate_notes')
        .update({ note: editingNoteText.trim() })
        .eq('id', editingNoteId);

      if (error) throw error;

      // Log activity
      logActivity.mutate({
        applicantId: application.applicant_id,
        activityType: 'note_edited',
        newValue: editingNoteText.trim().substring(0, 100),
        metadata: { job_id: application.job_id },
      });

      toast.success('Anteckning uppdaterad');
      setEditingNoteId(null);
      setEditingNoteText('');
      fetchNotes();
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Kunde inte uppdatera anteckning');
    } finally {
      setSavingNote(false);
    }
  };
  
  if (!application) return null;

  // Use activeApplication for display, but keep application for initial check
  const displayApp = activeApplication || application;
  const initials = `${displayApp.first_name?.[0] || ''}${displayApp.last_name?.[0] || ''}`.toUpperCase();
  const currentStatus = statusConfig[displayApp.status as keyof typeof statusConfig] || statusConfig.pending;
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus hideClose className="max-w-[950px] max-h-[85vh] overflow-hidden bg-card-parium backdrop-blur-md border-white/20 text-white p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Kandidatprofil: {displayApp.first_name} {displayApp.last_name}</DialogTitle>
          <DialogDescription>Visa kandidatens profilinformation och ansökan</DialogDescription>
        </DialogHeader>
        
        <div className="flex h-full max-h-[85vh]">
          {/* Main content - left side */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Header with circular profile image/video */}
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Circular Profile Image/Video - Larger */}
            <div className="relative">
              {isProfileVideo && videoUrl ? (
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
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
                <Avatar className="w-40 h-40 md:w-48 md:h-48 border-4 border-white/20 shadow-xl">
                  <AvatarImage 
                    src={profileImageUrl || ''} 
                    alt={`${displayApp.first_name} ${displayApp.last_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-white/10 text-white text-4xl md:text-5xl font-semibold" delayMs={200}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            
            {/* Name, Rating and Job Selector */}
            <div className="w-full max-w-sm">
              <h2 className="text-2xl font-semibold text-white">
                {displayApp.first_name} {displayApp.last_name}
              </h2>
              
              {/* Star Rating - Interactive */}
              {onRatingChange && (
                <div className="mt-2">
                  <InteractiveStarRating 
                    rating={candidateRating} 
                    onChange={handleRatingChange} 
                  />
                </div>
              )}
              
              {/* Job dropdown or single job display */}
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
                      {allApplications.map((app) => (
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
                    ({allApplications.length} jobbansökningar)
                  </p>
                </div>
              ) : (
                <p className="text-white mt-1">{displayApp.job_title}</p>
              )}
            </div>
          </div>

          {/* Info sections - compact version */}
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
                    <a
                      href={`mailto:${displayApp.email}`}
                      className="text-sm text-white hover:text-white/80 transition-colors truncate"
                    >
                      {displayApp.email}
                    </a>
                  </div>
                )}
                {displayApp.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-white shrink-0" />
                    <a
                      href={`tel:${displayApp.phone}`}
                      className="text-sm text-white hover:text-white/80 transition-colors"
                    >
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
                      <p className="text-sm text-white">{displayApp.employment_status}</p>
                    </div>
                  )}
                  {displayApp.work_schedule && (
                    <div>
                      <span className="text-sm text-white">Hur mycket jobbar du idag?</span>
                      <p className="text-sm text-white">{displayApp.work_schedule}</p>
                    </div>
                  )}
                  {displayApp.availability && (
                    <div className="sm:col-span-2">
                      <span className="text-sm text-white">När kan du börja nytt jobb?</span>
                      <p className="text-sm text-white">{displayApp.availability}</p>
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
                          {String(answer) || <span className="opacity-50 italic">Inget svar</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Summary Section - Only show if it's a valid CV */}
            {aiSummary?.is_valid_cv !== false && (
              <div className="bg-white/10 border border-white/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Sammanfattning
                    <span className="text-[9px] font-normal normal-case bg-white/20 px-1.5 py-0.5 rounded-full">
                      Baserat på CV
                    </span>
                  </h3>
                </div>

                {loadingSummary || generatingSummary ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                    <span className="ml-2 text-sm text-white/50">Analyserar CV...</span>
                  </div>
                ) : aiSummary ? (
                  <div>
                    {/* Key points as bullet list */}
                    {(() => {
                      const displayPoints = (aiSummary.key_points || []).filter(
                        (point: any) => typeof point?.text === 'string' && !point.text.startsWith('Dokumenttyp:')
                      );

                      if (displayPoints.length > 0) {
                        return (
                          <ul className="space-y-1">
                            {displayPoints.map((point: any, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-white">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                                    point.type === 'negative' ? 'bg-red-400' : 'bg-white'
                                  }`}
                                />
                                <span>{point.text}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      return (
                        <p className="text-sm text-white leading-relaxed">
                          {aiSummary.summary_text}
                        </p>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-3">
                    {signedCvUrl ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                        <span className="ml-2 text-sm text-white/50">Genererar sammanfattning...</span>
                      </div>
                    ) : (
                      <p className="text-sm text-white/50">
                        Kandidaten har inte laddat upp något CV
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Not a CV indicator */}
            {aiSummary?.is_valid_cv === false && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-orange-300">
                    Dokumentet är {aiSummary.document_type || 'inte ett CV'} – ingen sammanfattning tillgänglig
                  </span>
                </div>
              </div>
            )}

            {/* CV Section */}
            {displayApp.cv_url && (
              <div className="bg-white/10 border border-white/20 rounded-lg p-3">
                <h3 className="text-[10px] font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  CV
                </h3>
                <div className="w-full py-2 bg-white/5 border border-white/10 rounded-md flex items-center px-2.5 gap-2">
                  <button
                    type="button"
                    onClick={() => setCvOpen(true)}
                    className="flex items-center gap-2 text-white transition-colors flex-1"
                  >
                    <FileText className="h-3.5 w-3.5 text-white shrink-0" />
                    <span className="text-sm">Visa CV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCvOpen(true)}
                    className="text-white hover:text-white/80 transition-colors"
                    title="Öppna CV"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Presentation om kandidaten */}
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
                <p className="text-sm text-white/50 italic">Ingen presentation angiven</p>
              )}
            </div>
          </div>

            {/* Actions - show stage navigation + book meeting for my-candidates, only Book meeting for all-candidates */}
            {variant === 'my-candidates' ? (
              <div className="pt-4 border-t border-white/20 space-y-3">
                {/* Action buttons row - grid layout for perfect center alignment */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Left column - Meddelande */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setSendMessageOpen(true)}
                      variant="glassPurple"
                      size="default"
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      Meddelande
                    </Button>
                  </div>
                  
                  {/* Center column - Boka möte (perfectly centered) */}
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setBookInterviewOpen(true)}
                      variant="glassBlue"
                      size="default"
                    >
                      <CalendarPlus className="h-4 w-4 mr-1.5" />
                      Boka möte
                    </Button>
                  </div>
                  
                  {/* Right column - Dela + Ta bort */}
                  <div className="flex justify-start gap-2">
                    {hasTeam && (
                      <Button
                        onClick={() => setShareDialogOpen(true)}
                        variant="glassAmber"
                        size="default"
                      >
                        <Users className="h-4 w-4 mr-1.5" />
                        Dela
                      </Button>
                    )}
                    <Button
                      onClick={() => setRemoveConfirmOpen(true)}
                      variant="glassRed"
                      size="default"
                    >
                      <UserMinus className="h-4 w-4 mr-1.5" />
                      Ta bort
                    </Button>
                  </div>
                </div>

                {/* Stage navigation buttons */}
                {currentStage && stageOrder && stageConfig && onStageChange && stageOrder.length > 1 && (() => {
                  const currentIndex = stageOrder.indexOf(currentStage);
                  const prevStage = currentIndex > 0 ? stageOrder[currentIndex - 1] : null;
                  const nextStage = currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
                  const prevLabel = prevStage ? stageConfig[prevStage]?.label || prevStage : null;
                  const nextLabel = nextStage ? stageConfig[nextStage]?.label || nextStage : null;
                  
                  return (
                    <div className="space-y-2">
                      {/* Section label */}
                      <p className="text-center text-white text-xs font-medium">Flytta kandidat</p>
                      
                      <div className="flex items-center justify-between gap-2">
                        {/* Previous stage button */}
                        <button
                          onClick={() => prevStage && onStageChange(prevStage)}
                          disabled={!prevStage}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                            prevStage 
                              ? 'text-white bg-white/10 hover:bg-white/20' 
                              : 'opacity-40 text-white/50'
                          }`}
                        >
                          <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">Till {(prevLabel || 'föregående').replace('?', '')}</span>
                        </button>

                        {/* Current stage indicator */}
                        <div className="flex-shrink-0 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium whitespace-nowrap">
                          {(stageConfig[currentStage]?.label || currentStage).replace('?', '')}
                        </div>

                        {/* Next stage button */}
                        <button
                          onClick={() => nextStage && onStageChange(nextStage)}
                          disabled={!nextStage}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                            nextStage 
                              ? 'text-white bg-white/10 hover:bg-white/20' 
                              : 'opacity-40 text-white/50'
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
              /* Fixed footer button for all-candidates view */
              <div className="border-t border-white/15 pt-4 mt-4 flex justify-center gap-2">
                <Button
                  onClick={() => setSendMessageOpen(true)}
                  variant="glassPurple"
                  size="default"
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Meddelande
                </Button>
                <Button
                  onClick={() => setBookInterviewOpen(true)}
                  variant="glassBlue"
                  size="default"
                >
                  <CalendarPlus className="h-4 w-4 mr-1.5" />
                  Boka möte
                </Button>
              </div>
            )}
          </div>

          {/* Activity Sidebar - right side */}
          <div className="w-80 border-l border-white/20 bg-white/5 flex flex-col overflow-hidden relative">
            {/* Tabs + close */}
            <div className="relative flex border-b border-white/20 pr-10">
              <button
                onClick={() => setSidebarTab('activity')}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === 'activity' 
                    ? 'text-white border-b-2 border-white' 
                    : 'text-white/50 hover:text-white/70'
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
                  sidebarTab === 'comments' 
                    ? 'text-white border-b-2 border-white' 
                    : 'text-white/50 hover:text-white/70'
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
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3">
              {sidebarTab === 'activity' ? (
                <CandidateActivityLog applicantId={application?.applicant_id || null} />
              ) : (
                <div className="space-y-3">
                  {/* Add new note */}
                  <div className="space-y-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Skriv en anteckning..."
                      className="w-full min-h-[60px] bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none text-xs"
                    />
                    <Button
                      onClick={saveNote}
                      disabled={!newNote.trim() || savingNote}
                      size="sm"
                      className="w-full rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                    >
                      <Send className="h-3 w-3 mr-1.5" />
                      Lägg till
                    </Button>
                  </div>

                  {loadingNotes ? (
                    <div className="space-y-2 py-2">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="p-2 rounded bg-white/5">
                          <Skeleton className="h-3 w-full bg-white/10 mb-1" />
                          <Skeleton className="h-3 w-2/3 bg-white/10" />
                        </div>
                      ))}
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-xs text-white text-center py-4">Inga anteckningar ännu</p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        // Group notes by date
                        const groupedNotes = notes.reduce((groups, note) => {
                          const date = new Date(note.created_at).toLocaleDateString('sv-SE', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          });
                          if (!groups[date]) {
                            groups[date] = [];
                          }
                          groups[date].push(note);
                          return groups;
                        }, {} as Record<string, typeof notes>);

                        return Object.entries(groupedNotes).map(([date, dateNotes]) => (
                          <div key={date}>
                            <p className="text-xs text-white mb-2 capitalize">{date}</p>
                            <div className="space-y-2">
                              {dateNotes.map((note) => (
                                <div 
                                  key={note.id}
                                  className="bg-white/5 rounded-lg p-2.5 group relative"
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-[10px] font-medium text-white">
                                      {note.author_name || 'Okänd'}
                                    </span>
                                  </div>
                                  
                                  {editingNoteId === note.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editingNoteText}
                                        onChange={(e) => setEditingNoteText(e.target.value)}
                                        className="min-h-[60px] text-xs bg-white/10 border-white/20 text-white resize-none"
                                        placeholder="Skriv din anteckning..."
                                      />
                                      <div className="flex gap-1.5">
                                        <Button
                                          size="sm"
                                          onClick={updateNote}
                                          disabled={savingNote || !editingNoteText.trim()}
                                          className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700"
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          Spara
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={cancelEditingNote}
                                          className="h-6 text-[10px] px-2 text-white/70 hover:text-white hover:bg-white/10"
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Avbryt
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-xs text-white whitespace-pre-wrap pr-10 leading-relaxed">{note.note}</p>
                                      <p className="text-[10px] text-white mt-1">
                                        {new Date(note.created_at).toLocaleTimeString('sv-SE', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                      {note.employer_id === user?.id && (
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                          <button
                                            onClick={() => startEditingNote(note)}
                                            className="p-1.5 text-white hover:text-white hover:bg-white/10 rounded-full transition-all duration-300"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => confirmDeleteNote(note.id)}
                                            className="p-1.5 text-white hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-300"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContentNoFocus>
    </Dialog>

    {/* CV Dialog - matching profile page exactly */}
    <Dialog open={cvOpen} onOpenChange={setCvOpen}>
      <DialogContentNoFocus className="max-w-4xl max-h-[90vh] overflow-hidden bg-transparent border-none shadow-none p-8">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-white text-2xl">CV</DialogTitle>
        </DialogHeader>
        {displayApp?.cv_url && signedCvUrl && (
          <CvViewer 
            src={signedCvUrl} 
            fileName="cv.pdf" 
            height="70vh"
            onClose={() => setCvOpen(false)}
          />
        )}
      </DialogContentNoFocus>
    </Dialog>

    {/* Delete note confirmation dialog */}
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

    {/* Remove from list confirmation dialog */}
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
