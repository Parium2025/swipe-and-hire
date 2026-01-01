import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { JobCriteriaManager, CriterionResultBadge } from '@/components/JobCriteriaManager';
import { SelectionCriteriaDialog } from '@/components/SelectionCriteriaDialog';
import { JobStageSettingsMenu } from '@/components/JobStageSettingsMenu';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';
import { useJobStageSettings, getJobStageIconByName, DEFAULT_JOB_STAGE_KEYS } from '@/hooks/useJobStageSettings';
import { 
  Clock, 
  X,
  Users,
  Eye,
  Play,
  Star,
  ArrowDown,
  Trash2,
  Phone as PhoneIcon,
  Calendar,
  Gift,
  PartyPopper,
  Inbox,
  MapPin,
  Sparkles,
  Plus
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, differenceInHours } from 'date-fns';
import EmployerLayout from '@/components/EmployerLayout';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { columnXCollisionDetection } from '@/lib/dnd/columnCollisionDetection';

// Types for criterion results
interface CriterionResult {
  criterion_id: string;
  result: 'match' | 'no_match' | 'no_data';
  reasoning?: string;
  title: string;
}

interface JobApplication {
  id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: number;
  location: string;
  bio: string;
  cv_url: string;
  employment_status: string;
  availability: string;
  applied_at: string;
  status: 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';
  custom_answers: any;
  viewed_at: string | null;
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean;
  rating: number;
  criterionResults?: CriterionResult[];
}

// Format time in compact way like MyCandidates
const formatCompactTime = (date: string | null) => {
  if (!date) return null;
  const now = new Date();
  const d = new Date(date);
  const days = differenceInDays(now, d);
  const hours = differenceInHours(now, d);
  
  if (days >= 1) {
    return `${days}dag`;
  }
  return `${hours}tim`;
};

const STATUS_ICONS = {
  pending: Inbox,
  reviewing: Eye,
  interview: Calendar,
  offered: Gift,
  hired: PartyPopper,
};

// Star rating component - read-only for cards
const StarRating = ({ rating = 0, maxStars = 5 }: { rating?: number; maxStars?: number }) => {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star 
          key={i}
          className={`h-2.5 w-2.5 ${
            i < rating 
              ? 'text-yellow-400 fill-yellow-400' 
              : 'text-white/30'
          }`}
        />
      ))}
    </div>
  );
};

interface JobPosting {
  id: string;
  title: string;
  location: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
}

type ApplicationStatus = 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';

const STATUS_ORDER: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'offered', 'hired'];

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; hoverRing: string }> = {
  pending: { label: 'Inkorg', color: 'bg-yellow-500/20 ring-1 ring-inset ring-yellow-500/50 text-yellow-300', hoverRing: 'ring-yellow-500/70' },
  reviewing: { label: 'Granskar', color: 'bg-blue-500/20 ring-1 ring-inset ring-blue-500/50 text-blue-300', hoverRing: 'ring-blue-500/70' },
  interview: { label: 'Intervju', color: 'bg-purple-500/20 ring-1 ring-inset ring-purple-500/50 text-purple-300', hoverRing: 'ring-purple-500/70' },
  offered: { label: 'Erbjuden', color: 'bg-green-500/20 ring-1 ring-inset ring-green-500/50 text-green-300', hoverRing: 'ring-green-500/70' },
  hired: { label: 'Anställd', color: 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/50 text-emerald-300', hoverRing: 'ring-emerald-500/70' },
  rejected: { label: 'Avvisad', color: 'bg-red-500/20 ring-1 ring-inset ring-red-500/50 text-red-300', hoverRing: 'ring-red-500/70' },
};

// Small Candidate Avatar Wrapper - MUST be outside JobDetails to prevent recreation
const SmallCandidateAvatarWrapper = ({ application }: { application: JobApplication }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const hasVideo = application.is_profile_video && application.video_url;
  
  return (
    <div 
      className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 relative [&>*:first-child]:h-7 [&>*:first-child]:w-7 md:[&>*:first-child]:h-8 md:[&>*:first-child]:w-8 [&_.h-10]:h-7 [&_.w-10]:w-7 md:[&_.h-10]:h-8 md:[&_.w-10]:w-8 [&_.ring-2]:ring-1"
      onClick={hasVideo ? (e) => {
        e.stopPropagation();
      } : undefined}
    >
      <CandidateAvatar
        profileImageUrl={application.profile_image_url}
        videoUrl={application.video_url}
        isProfileVideo={application.is_profile_video}
        firstName={application.first_name}
        lastName={application.last_name}
        onPlayingChange={setIsVideoPlaying}
      />
      {hasVideo && !isVideoPlaying && (
        <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center pointer-events-none">
          <Play className="h-3 w-3 md:h-4 md:w-4 text-white drop-shadow-lg fill-white" />
        </div>
      )}
    </div>
  );
};

// Application Card Content - MUST be outside JobDetails to prevent recreation
const ApplicationCardContent = ({ 
  application, 
  isDragging, 
  onOpenProfile,
  onMarkAsViewed
}: { 
  application: JobApplication; 
  isDragging?: boolean; 
  onOpenProfile?: () => void;
  onMarkAsViewed?: (id: string) => void;
}) => {
  const isUnread = !application.viewed_at;
  const appliedTime = formatCompactTime(application.applied_at);
  const criterionResults = application.criterionResults || [];
  
  const handleClick = () => {
    if (isUnread && onMarkAsViewed) {
      onMarkAsViewed(application.id);
    }
    onOpenProfile?.();
  };
  
  return (
    <div 
      className={`bg-white/5 ring-1 ring-inset ring-white/10 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing group relative
        transition-all duration-200 ease-out
        ${isDragging 
          ? 'ring-2 ring-inset ring-primary/50 bg-white/10 scale-[1.02] shadow-lg shadow-primary/20' 
          : 'hover:ring-white/30 hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20'
        }`}
      onClick={handleClick}
    >
      {isUnread && (
        <div className="absolute right-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <SmallCandidateAvatarWrapper application={application} />
        
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-fuchsia-400 font-medium text-xs truncate group-hover:text-fuchsia-300 transition-colors">
            {application.first_name} {application.last_name}
          </p>
          <StarRating rating={application.rating} />
          {appliedTime && (
            <div className="flex items-center gap-1.5 mt-0.5 text-white/70 text-[10px] group-hover:text-white/80 transition-colors">
              <span className="flex items-center gap-0.5">
                <ArrowDown className="h-2.5 w-2.5" />
                {appliedTime}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {appliedTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Criterion Results */}
      {criterionResults.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/5">
          {criterionResults.slice(0, 3).map((cr) => (
            <CriterionResultBadge
              key={cr.criterion_id}
              result={cr.result}
              title={cr.title}
              reasoning={cr.reasoning}
            />
          ))}
          {criterionResults.length > 3 && (
            <span className="text-[10px] text-white/50">+{criterionResults.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
};

// Sortable Application Card - MUST be outside JobDetails to stabilize useSortable hook
const SortableApplicationCard = ({ 
  application, 
  onOpenProfile,
  onMarkAsViewed
}: { 
  application: JobApplication; 
  onOpenProfile: () => void;
  onMarkAsViewed?: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ApplicationCardContent 
        application={application} 
        isDragging={isDragging} 
        onOpenProfile={onOpenProfile}
        onMarkAsViewed={onMarkAsViewed}
      />
    </div>
  );
};

// Status Column - MUST be outside JobDetails to stabilize useDroppable hook
interface StatusColumnProps {
  jobId: string;
  status: string;
  applications: JobApplication[];
  onOpenProfile: (app: JobApplication) => void;
  onMarkAsViewed: (id: string) => void;
  onOpenCriteriaDialog?: () => void;
  stageConfig: {
    label: string;
    color: string;
    iconName: string;
    isCustom: boolean;
  };
  totalStageCount: number;
}

const StatusColumn = ({ 
  jobId,
  status, 
  applications, 
  onOpenProfile, 
  onMarkAsViewed, 
  onOpenCriteriaDialog,
  stageConfig,
  totalStageCount
}: StatusColumnProps) => {
  const [liveColor, setLiveColor] = useState<string | null>(null);
  const displayColor = liveColor || stageConfig.color;
  const Icon = getJobStageIconByName(stageConfig.iconName);
  
  // Use useDroppable's own isOver for accurate detection
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex-1 min-w-[220px] max-w-[280px] flex flex-col transition-colors"
      style={{ minHeight: 'calc(100vh - 280px)' }}
    >
      <div 
        className="rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset"
        style={{ 
          backgroundColor: `${displayColor}33`,
          color: displayColor,
          borderColor: `${displayColor}80`,
          ...(isOver && { ringWidth: '2px', ringColor: displayColor })
        }}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-medium text-xs">{stageConfig.label}</span>
          <span 
            className="text-white/90 text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${displayColor}66` }}
          >
            {applications.length}
          </span>
          {/* AI Criteria button - only show on Inkorg (pending) */}
          {status === 'pending' && onOpenCriteriaDialog && (
            <button
              onClick={onOpenCriteriaDialog}
              className="p-1 rounded hover:bg-white/20 transition-colors text-white/70 hover:text-primary"
              title="Urvalskriterier"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="ml-auto">
            <JobStageSettingsMenu 
              jobId={jobId}
              stageKey={status}
              candidateCount={applications.length}
              totalStageCount={totalStageCount}
              onLiveColorChange={setLiveColor}
            />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 space-y-1 overflow-y-auto p-1 pr-2">
        {/* Drop indicator at top */}
        {isOver && (
          <div className="mb-2 flex items-center justify-center">
            <div className="rounded-md bg-white/10 backdrop-blur-sm ring-1 ring-inset ring-white/20 px-4 py-3 text-xs font-medium text-white animate-pulse">
              Släpp här
            </div>
          </div>
        )}

        <SortableContext items={applications.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {applications.map((app) => (
            <SortableApplicationCard 
              key={app.id} 
              application={app} 
              onOpenProfile={() => onOpenProfile(app)}
              onMarkAsViewed={onMarkAsViewed}
            />
          ))}
        </SortableContext>

        {applications.length === 0 && !isOver && (
          <div className="text-center py-8 text-xs text-white">
            Inga kandidater i detta steg
          </div>
        )}
      </div>
    </div>
  );
};

const JobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [myCandidatesMap, setMyCandidatesMap] = useState<Map<string, string>>(new Map()); // applicant_id -> my_candidate_id
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);

  // Use job-specific stage settings
  const { stageSettings, orderedStages, isLoading: stagesLoading } = useJobStageSettings(jobId);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Use orderedStages if available, otherwise default
  const activeStages = orderedStages.length > 0 ? orderedStages : [...DEFAULT_JOB_STAGE_KEYS];

  const collisionDetectionStrategy = useMemo(
    () => columnXCollisionDetection(activeStages),
    [activeStages]
  );

  useEffect(() => {
    if (!jobId || !user) return;
    fetchJobData();
  }, [jobId, user]);

  const fetchJobData = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .eq('employer_id', user?.id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      
      // Fetch my_candidates ratings and IDs for this recruiter
      const { data: myCandidatesData } = await supabase
        .from('my_candidates')
        .select('id, applicant_id, rating')
        .eq('recruiter_id', user?.id);
      
      const ratingsByApplicant = new Map<string, number>();
      const candidateIdsMap = new Map<string, string>();
      (myCandidatesData || []).forEach(mc => {
        ratingsByApplicant.set(mc.applicant_id, mc.rating || 0);
        candidateIdsMap.set(mc.applicant_id, mc.id);
      });
      setMyCandidatesMap(candidateIdsMap);

      // Fetch criteria for this job
      const { data: criteriaData } = await supabase
        .from('job_criteria')
        .select('id, title')
        .eq('job_id', jobId);
      
      const criteriaMap = new Map<string, string>();
      (criteriaData || []).forEach(c => criteriaMap.set(c.id, c.title));

      // Fetch criterion results for all applicants
      const applicantIds = (applicationsData || []).map(a => a.applicant_id);
      const { data: evaluationsData } = await supabase
        .from('candidate_evaluations')
        .select('id, applicant_id')
        .eq('job_id', jobId)
        .in('applicant_id', applicantIds.length > 0 ? applicantIds : ['']);

      const evaluationIds = (evaluationsData || []).map(e => e.id);
      const evaluationByApplicant = new Map<string, string>();
      (evaluationsData || []).forEach(e => evaluationByApplicant.set(e.applicant_id, e.id));

      const { data: criterionResultsData } = await supabase
        .from('criterion_results')
        .select('evaluation_id, criterion_id, result, reasoning')
        .in('evaluation_id', evaluationIds.length > 0 ? evaluationIds : ['']);

      // Group results by evaluation_id
      const resultsByEvaluation = new Map<string, CriterionResult[]>();
      (criterionResultsData || []).forEach(cr => {
        const title = criteriaMap.get(cr.criterion_id) || 'Okänt kriterium';
        const result: CriterionResult = {
          criterion_id: cr.criterion_id,
          result: cr.result as 'match' | 'no_match' | 'no_data',
          reasoning: cr.reasoning || undefined,
          title,
        };
        const existing = resultsByEvaluation.get(cr.evaluation_id) || [];
        existing.push(result);
        resultsByEvaluation.set(cr.evaluation_id, existing);
      });

      // Fetch profile media for each applicant using RPC
      const applicationsWithMedia = await Promise.all(
        (applicationsData || []).map(async (app) => {
          const { data: mediaData } = await supabase.rpc('get_applicant_profile_media', {
            p_applicant_id: app.applicant_id,
            p_employer_id: user?.id
          });
          
          const media = (mediaData?.[0] || {}) as {
            profile_image_url?: string;
            video_url?: string;
            is_profile_video?: boolean;
          };

          // Get criterion results for this applicant
          const evalId = evaluationByApplicant.get(app.applicant_id);
          const criterionResults = evalId ? resultsByEvaluation.get(evalId) || [] : [];

          return {
            ...app,
            profile_image_url: media.profile_image_url || null,
            video_url: media.video_url || null,
            is_profile_video: media.is_profile_video || false,
            rating: ratingsByApplicant.get(app.applicant_id) || 0,
            criterionResults,
          };
        })
      );
      
      setApplications(applicationsWithMedia as JobApplication[]);
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    // Optimistic update - move card immediately
    const previousApplications = [...applications];
    setApplications(prev => prev.map(app => 
      app.id === applicationId 
        ? { ...app, status: newStatus as JobApplication['status'] } 
        : app
    ));

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) {
        // Revert on error
        setApplications(previousApplications);
        throw error;
      }
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateCandidateRating = async (applicantId: string, newRating: number) => {
    const myCandidateId = myCandidatesMap.get(applicantId);
    if (!myCandidateId) {
      toast({ title: 'Info', description: 'Lägg först till kandidaten i din lista för att ge betyg' });
      return;
    }
    setApplications(prev => prev.map(app => app.applicant_id === applicantId ? { ...app, rating: newRating } : app));
    if (selectedApplication?.applicant_id === applicantId) {
      setSelectedApplication(prev => prev ? { ...prev, rating: newRating } : null);
    }
    try {
      const { error } = await supabase.from('my_candidates').update({ rating: newRating }).eq('id', myCandidateId);
      if (error) throw error;
    } catch {
      toast({ title: 'Fel', description: 'Kunde inte uppdatera betyg', variant: 'destructive' });
      fetchJobData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'reviewing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'interview':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'offered':
        return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'hired':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'rejected':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Inkorg';
      case 'reviewing': return 'Granskar';
      case 'interview': return 'Intervju';
      case 'offered': return 'Erbjuden';
      case 'hired': return 'Anställd';
      case 'rejected': return 'Avvisad';
      default: return status;
    }
  };

  const filterApplicationsByStatus = (status: string) => {
    return applications.filter(app => app.status === status);
  };

  const markApplicationAsViewed = async (applicationId: string) => {
    try {
      await supabase
        .from('job_applications')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('viewed_at', null);
      
      // Update local state
      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { ...app, viewed_at: new Date().toISOString() } : app
      ));
    } catch (error) {
      console.error('Error marking as viewed:', error);
    }
  };

  // Memoize applications by status to prevent unnecessary re-renders
  const applicationsByStatus = useMemo(() => {
    const result: Record<string, JobApplication[]> = {};
    // Initialize all active stages
    activeStages.forEach(stage => {
      result[stage] = [];
    });
    // Also add rejected in case there are any
    result['rejected'] = [];
    
    applications.forEach(app => {
      if (result[app.status]) {
        result[app.status].push(app);
      }
    });
    return result;
  }, [applications, activeStages]);

  const handleOpenProfile = useCallback((app: JobApplication) => {
    setSelectedApplication(app);
    setDialogOpen(true);
  }, []);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const resolveOverStatus = (overRawId?: string): ApplicationStatus | null => {
    if (!overRawId) return null;

    if (STATUS_ORDER.includes(overRawId as ApplicationStatus)) {
      return overRawId as ApplicationStatus;
    }

    const overApp = applications.find((a) => a.id === overRawId);
    if (overApp && STATUS_ORDER.includes(overApp.status as ApplicationStatus)) {
      return overApp.status as ApplicationStatus;
    }

    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overRawId = event.over?.id as string | undefined;
    const status = resolveOverStatus(overRawId);
    setOverId(status);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const applicationId = active.id as string;
    const overRawId = over.id as string;
    const targetStatus = resolveOverStatus(overRawId);

    if (!targetStatus) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const application = applications.find((a) => a.id === applicationId);
    if (application && application.status !== targetStatus) {
      // Update status FIRST (optimistic update)
      updateApplicationStatus(applicationId, targetStatus);
      // Clear drag state after a frame to ensure optimistic update is rendered
      requestAnimationFrame(() => {
        setActiveId(null);
        setOverId(null);
      });
    } else {
      setActiveId(null);
      setOverId(null);
    }
  };

  const activeApplication = activeId ? applications.find(a => a.id === activeId) : null;

  if (loading) {
    return null; // Return nothing while loading for smooth fade-in
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 py-4 pb-safe min-h-screen animate-fade-in">
        {/* Job Title and Stats */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 md:p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <TruncatedText 
                text={job.title}
                className="text-xl font-bold text-white mb-2 two-line-ellipsis block"
              />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-white">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </div>
                <Badge
                  className={`text-sm whitespace-nowrap cursor-pointer transition-colors ${
                    job.is_active
                      ? "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                      : "bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30"
                  }`}
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('job_postings')
                        .update({ is_active: !job.is_active })
                        .eq('id', jobId);

                      if (error) throw error;

                      toast({
                        title: job.is_active ? 'Jobb inaktiverat' : 'Jobb aktiverat',
                        description: job.is_active ? 'Jobbet är nu inaktivt.' : 'Jobbet är nu aktivt.',
                      });

                      fetchJobData();
                    } catch (error: any) {
                      toast({
                        title: 'Fel',
                        description: error.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  {job.is_active ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-white h-8 w-8 p-0 hover:bg-transparent focus-visible:ring-0 focus:outline-none"
            >
              <X className="h-7 w-7" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="bg-white/5 rounded-lg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2 text-white text-xs md:text-sm mb-1">
                <Eye className="h-3 w-3 md:h-4 md:w-4" />
                Visningar
              </div>
              <div className="text-lg md:text-xl font-bold text-white">{job.views_count}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 md:p-3">
              <div className="flex items-center gap-1 md:gap-2 text-white text-xs md:text-sm mb-1">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                Ansökningar
              </div>
              <div className="text-lg md:text-xl font-bold text-white">{job.applications_count}</div>
            </div>
          </div>
        </div>

        {/* AI Criteria Manager */}
        {jobId && (
          <JobCriteriaManager jobId={jobId} onCriteriaChange={fetchJobData} />
        )}

        {/* Kanban View with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2" style={{ minHeight: 'calc(100vh - 300px)' }}>
            {activeStages.map((status) => {
              const config = stageSettings[status] || { label: status, color: '#0EA5E9', iconName: 'inbox', isCustom: false };
              return (
                <StatusColumn 
                  key={status}
                  jobId={jobId || ''}
                  status={status}
                  applications={applicationsByStatus[status] || []}
                  onOpenProfile={handleOpenProfile}
                  onMarkAsViewed={markApplicationAsViewed}
                  onOpenCriteriaDialog={status === 'pending' ? () => setCriteriaDialogOpen(true) : undefined}
                  stageConfig={config}
                  totalStageCount={activeStages.length}
                />
              );
            })}
            {/* Add new stage button */}
            <div className="flex-shrink-0 flex items-start pt-1">
              <CreateJobStageDialog 
                jobId={jobId || ''}
                trigger={
                  <button className="px-3 py-1.5 text-xs font-medium rounded-md transition-all text-white ring-1 ring-inset ring-primary/40 bg-primary/10 hover:bg-primary/20 backdrop-blur-sm flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Nytt steg
                  </button>
                }
              />
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
            {activeApplication ? (
              <div className="opacity-95 pointer-events-none">
                <ApplicationCardContent application={activeApplication} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Candidate Profile Dialog */}
        <CandidateProfileDialog
          application={selectedApplication ? {
            id: selectedApplication.id,
            job_id: jobId || '',
            applicant_id: selectedApplication.applicant_id,
            first_name: selectedApplication.first_name,
            last_name: selectedApplication.last_name,
            email: selectedApplication.email,
            phone: selectedApplication.phone,
            location: selectedApplication.location,
            bio: selectedApplication.bio,
            cv_url: selectedApplication.cv_url,
            age: selectedApplication.age,
            employment_status: selectedApplication.employment_status,
            work_schedule: null,
            availability: selectedApplication.availability,
            custom_answers: selectedApplication.custom_answers,
            status: selectedApplication.status,
            applied_at: selectedApplication.applied_at,
            updated_at: selectedApplication.applied_at,
            job_title: job?.title || 'Okänt jobb',
            profile_image_url: selectedApplication.profile_image_url,
            video_url: selectedApplication.video_url,
            is_profile_video: selectedApplication.is_profile_video,
          } as ApplicationData : null}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTimeout(() => setSelectedApplication(null), 300);
            }
          }}
          onStatusUpdate={() => {
            fetchJobData();
          }}
          candidateRating={selectedApplication?.rating}
          onRatingChange={(rating) => {
            if (selectedApplication) {
              updateCandidateRating(selectedApplication.applicant_id, rating);
            }
          }}
        />

        {/* Selection Criteria Dialog */}
        {jobId && (
          <SelectionCriteriaDialog
            open={criteriaDialogOpen}
            onOpenChange={setCriteriaDialogOpen}
            jobId={jobId}
            onActivate={(count) => {
              toast({ title: `${count} urvalskriterier aktiverade`, description: 'AI börjar utvärdera kandidater' });
            }}
          />
        )}
      </div>
  );
};

export default JobDetails;
