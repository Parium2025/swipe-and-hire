import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
import { useJobDetailsData, type JobApplication } from '@/hooks/useJobDetailsData';
import { 
  Clock, 
  X,
  Users,
  Eye,
  ChevronDown,
  Star,
  ArrowDown,
  Calendar,
  Gift,
  PartyPopper,
  Inbox,
  MapPin,
  Sparkles,
  Plus
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, differenceInHours } from 'date-fns';
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
  const hasVideo = application.is_profile_video && application.video_url;

  return (
    <div 
      className="h-8 w-8 flex-shrink-0 [&>*:first-child]:h-8 [&>*:first-child]:w-8 [&_.h-10]:h-8 [&_.w-10]:w-8 [&_.ring-2]:ring-1"
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
        stopPropagation={!!hasVideo}
      />
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
  const lastActiveTime = formatCompactTime(application.last_active_at);
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
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-fuchsia-400 font-medium text-xs truncate group-hover:text-fuchsia-300 transition-colors cursor-default">
                  {application.first_name} {application.last_name}
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{application.first_name} {application.last_name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <StarRating rating={application.rating} />
          {(appliedTime || lastActiveTime) && (
            <div className="flex items-center gap-1.5 mt-0.5 text-white text-[10px]">
              {appliedTime && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default">
                        <ArrowDown className="h-2.5 w-2.5" />
                        {appliedTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p>Ansökte till detta jobb</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {lastActiveTime && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default">
                        <Clock className="h-2.5 w-2.5" />
                        {lastActiveTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p>Senast aktiv i appen</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const displayColor = liveColor || stageConfig.color;
  const Icon = getJobStageIconByName(stageConfig.iconName);
  
  // Use useDroppable's own isOver for accurate detection
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  // Check scroll position to show/hide indicators
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    const hasScrollableContent = el.scrollHeight > el.clientHeight;
    const isAtTop = el.scrollTop <= 5;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
    
    setCanScrollUp(hasScrollableContent && !isAtTop);
    setCanScrollDown(hasScrollableContent && !isAtBottom);
  }, []);

  // Check scroll on mount and when applications change
  useEffect(() => {
    checkScroll();
  }, [applications.length, checkScroll]);

  return (
    <div 
      ref={setNodeRef}
      className="flex-1 min-w-[220px] max-w-[280px] flex flex-col transition-colors h-full"
    >
      <div 
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-white/20 backdrop-blur-sm flex-shrink-0 ${isOver ? 'ring-2 ring-white/40' : ''}`}
        style={{ backgroundColor: `${displayColor}33` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <span className="font-medium text-xs text-white truncate flex-1 min-w-0">{stageConfig.label}</span>
          <span 
            className="text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
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

      {/* Content area - with background container like MyCandidates */}
      <div className="relative flex-1 min-h-0 bg-white/[0.03] rounded-lg ring-1 ring-inset ring-white/10 backdrop-blur-sm">
        {/* Scroll up indicator */}
        {canScrollUp && (
          <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white/5 to-transparent z-10 pointer-events-none rounded-t-lg" />
        )}

        <div 
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="h-full overflow-y-auto space-y-1.5 p-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30"
        >
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

        {/* Scroll down indicator */}
        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/5 to-transparent z-10 pointer-events-none rounded-b-lg flex items-end justify-center pb-1">
            <div className="animate-bounce">
              <ChevronDown className="h-3.5 w-3.5 text-white/60" />
            </div>
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
  
  // Use cached data hook
  const { 
    job, 
    applications, 
    isLoading: dataLoading, 
    updateApplicationLocally, 
    updateJobLocally,
    refetch 
  } = useJobDetailsData(jobId);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [myCandidatesMap, setMyCandidatesMap] = useState<Map<string, string>>(new Map());
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);

  // Use job-specific stage settings
  const { stageSettings, orderedStages, isLoading: stagesLoading } = useJobStageSettings(jobId);

  // Load my_candidates map for ratings
  useEffect(() => {
    if (!user || applications.length === 0) return;
    
    const loadMyCandidatesMap = async () => {
      const applicantIds = applications.map(a => a.applicant_id);
      const { data } = await supabase
        .from('my_candidates')
        .select('id, applicant_id')
        .eq('recruiter_id', user.id)
        .in('applicant_id', applicantIds);
      
      const candidateIdsMap = new Map<string, string>();
      (data || []).forEach(mc => candidateIdsMap.set(mc.applicant_id, mc.id));
      setMyCandidatesMap(candidateIdsMap);
    };
    
    loadMyCandidatesMap();
  }, [user, applications]);

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

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    // Optimistic update via React Query cache
    updateApplicationLocally(applicationId, { status: newStatus as JobApplication['status'] });

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) {
        // Refetch on error to restore correct state
        refetch();
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
    
    // Optimistic update
    updateApplicationLocally(
      applications.find(a => a.applicant_id === applicantId)?.id || '',
      { rating: newRating }
    );
    if (selectedApplication?.applicant_id === applicantId) {
      setSelectedApplication(prev => prev ? { ...prev, rating: newRating } : null);
    }
    
    try {
      const { error } = await supabase.from('my_candidates').update({ rating: newRating }).eq('id', myCandidateId);
      if (error) throw error;
    } catch {
      toast({ title: 'Fel', description: 'Kunde inte uppdatera betyg', variant: 'destructive' });
      refetch();
    }
  };

  const markApplicationAsViewed = async (applicationId: string) => {
    // Optimistic update
    updateApplicationLocally(applicationId, { viewed_at: new Date().toISOString() });
    
    try {
      await supabase
        .from('job_applications')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('viewed_at', null);
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

  // Show skeleton while loading job data OR stage settings
  if (dataLoading || stagesLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12 py-4 pb-safe min-h-screen animate-fade-in">
        {/* Header skeleton */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 md:p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4 space-y-2">
              <div className="h-6 w-3/4 bg-white/10 rounded animate-pulse" />
              <div className="flex items-center gap-4">
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                <div className="h-5 w-16 bg-white/10 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-8 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white/5 rounded-lg p-2 md:p-3 space-y-2">
                <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                <div className="h-6 w-8 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* AI Criteria skeleton */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
            <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
          </div>
        </div>

        {/* Kanban skeleton */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-1 min-w-[220px] max-w-[280px] flex flex-col">
              <div className="rounded-md px-2 py-1.5 mb-2 bg-white/10 animate-pulse">
                <div className="h-4 w-24 bg-white/20 rounded" />
              </div>
              <div className="flex-1 space-y-2 p-1">
                {i <= 2 && (
                  <div className="bg-white/5 rounded-md p-2 space-y-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 w-20 bg-white/10 rounded" />
                        <div className="h-2 w-12 bg-white/10 rounded" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen animate-fade-in">
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

                      updateJobLocally({ is_active: !job.is_active });
                      refetch();
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
                {/* AI Criteria - compact button in header */}
                {jobId && (
                  <JobCriteriaManager jobId={jobId} onCriteriaChange={refetch} />
                )}
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
          <div 
            className="flex gap-4 pb-4 pt-2 px-2" 
            style={{ 
              height: 'calc(100vh - 300px)',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
            }}
          >
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
            refetch();
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
