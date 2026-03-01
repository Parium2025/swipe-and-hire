import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { prefetchCandidateActivities } from '@/hooks/useCandidateActivities';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { useDevice } from '@/hooks/use-device';
import { MobileCandidateView } from '@/components/MobileCandidateView';
import { CandidateSwipeViewer } from '@/components/candidates/CandidateSwipeViewer';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { CriterionResultBadge, CriterionIconBadge } from '@/components/JobCriteriaManager';
import { SelectionCriteriaDialog } from '@/components/SelectionCriteriaDialog';
import { JobStageSettingsMenu } from '@/components/JobStageSettingsMenu';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';
import { useJobStageSettings, getJobStageIconByName, DEFAULT_JOB_STAGE_KEYS } from '@/hooks/useJobStageSettings';
import { useJobDetailsData, type JobApplication } from '@/hooks/useJobDetailsData';
import { useJobCriteria } from '@/hooks/useCriteriaResults';
import { useKanbanLayout } from '@/hooks/useKanbanLayout';
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
  Plus,
  CheckSquare,
  Square,
  Trash2,
  QrCode,
} from 'lucide-react';
import JobQrCodeButton from '@/components/JobQrCode';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TruncatedText } from '@/components/TruncatedText';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatCompactTime } from '@/lib/date';
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
  onMarkAsViewed,
  onPrefetch,
  criteriaCount = 0,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: { 
  application: JobApplication; 
  isDragging?: boolean; 
  onOpenProfile?: () => void;
  onMarkAsViewed?: (id: string) => void;
  onPrefetch?: () => void;
  criteriaCount?: number;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) => {
  const isUnread = !application.viewed_at;
  const appliedTime = formatCompactTime(application.applied_at);
  const lastActiveTime = formatCompactTime(application.last_active_at);
  const criterionResults = application.criterionResults || [];
  
  // Check if criteria exist but candidate not evaluated
  const hasCriteria = criteriaCount > 0;
  const hasResults = criterionResults.length > 0;
  const needsEvaluation = hasCriteria && !hasResults;
  
  const handleClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
    } else {
      if (isUnread && onMarkAsViewed) {
        onMarkAsViewed(application.id);
      }
      onOpenProfile?.();
    }
  };
  
  return (
    <div 
      className={`bg-white/5 ring-1 ring-inset rounded-md px-2 py-1.5 group relative
        transition-all duration-200 ease-out
        ${isSelectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        ${isSelected 
          ? 'ring-1 ring-white/30 bg-white/[0.08]' 
          : isDragging 
            ? 'ring-2 ring-inset ring-primary/50 bg-white/10 scale-[1.02] shadow-lg shadow-primary/20' 
            : 'ring-white/10 hover:ring-white/30 hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20'
        }`}
      onClick={handleClick}
      onMouseEnter={onPrefetch}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <div className="absolute left-1.5 top-1.5 z-10">
          <Checkbox 
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            className="h-3.5 w-3.5 border border-white/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-white hover:border-white/70"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {isUnread && !isSelectionMode && (
        <div className="absolute right-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}
      
      <div className={`flex items-center gap-2 ${isSelectionMode ? 'ml-5' : ''}`}>
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

      {/* Criterion Results - show title + icon like Team Tailor */}
      {hasResults && (
        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/5">
          {criterionResults.map((cr) => (
            <CriterionIconBadge
              key={cr.criterion_id}
              result={cr.result}
              title={cr.title}
            />
          ))}
        </div>
      )}
      
      {/* "Väntar på AI" indicator removed — results appear silently when ready */}
    </div>
  );
};

// Sortable Application Card - MUST be outside JobDetails to stabilize useSortable hook
const SortableApplicationCard = ({ 
  application, 
  onOpenProfile,
  onMarkAsViewed,
  onPrefetch,
  criteriaCount = 0,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: { 
  application: JobApplication; 
  onOpenProfile: () => void;
  onMarkAsViewed?: (id: string) => void;
  onPrefetch?: () => void;
  criteriaCount?: number;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: application.id,
    disabled: isSelectionMode, // Disable drag in selection mode
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
  };

  // In selection mode, don't apply drag listeners
  const dragProps = isSelectionMode ? {} : { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style} {...dragProps}>
      <ApplicationCardContent 
        application={application} 
        isDragging={isDragging} 
        onOpenProfile={onOpenProfile}
        onMarkAsViewed={onMarkAsViewed}
        onPrefetch={onPrefetch}
        criteriaCount={criteriaCount}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
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
  onPrefetch?: (app: JobApplication) => void;
  onOpenCriteriaDialog?: () => void;
  stageConfig: {
    label: string;
    color: string;
    iconName: string;
    isCustom: boolean;
  };
  totalStageCount: number;
  criteriaCount?: number;
  // Selection mode props
  isSelectionMode?: boolean;
  selectedApplicationIds?: Set<string>;
  onToggleSelect?: (applicationId: string) => void;
  // Delete stage props
  targetStageKey?: string;
  targetStageLabel?: string;
  onMoveCandidatesAndDelete?: () => Promise<void>;
  stageIndex?: number;
}

const StatusColumn = ({ 
  jobId,
  status, 
  applications, 
  onOpenProfile, 
  onMarkAsViewed, 
  onPrefetch,
  onOpenCriteriaDialog,
  stageConfig,
  totalStageCount,
  criteriaCount = 0,
  isSelectionMode,
  selectedApplicationIds,
  onToggleSelect,
  targetStageKey,
  targetStageLabel,
  onMoveCandidatesAndDelete,
  stageIndex = 0,
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
      className="flex-shrink-0 flex flex-col transition-colors h-full"
      style={{ 
        width: '220px',
        minWidth: '200px',
      }}
    >
      <div 
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-white/20 backdrop-blur-sm flex-shrink-0 ${isOver ? 'ring-2 ring-white/40' : ''}`}
        style={{ backgroundColor: `${displayColor}55` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <TruncatedText
            text={stageConfig.label}
            className="font-medium text-xs text-white truncate flex-1 min-w-0"
          />
          <span 
            className="text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: `${displayColor}88` }}
          >
            {applications.length}
          </span>
          {/* AI Criteria button - only show on first stage */}
          {onOpenCriteriaDialog && (
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
              targetStageKey={targetStageKey}
              targetStageLabel={targetStageLabel}
              onMoveCandidatesAndDelete={onMoveCandidatesAndDelete}
              onLiveColorChange={setLiveColor}
              stageIndex={stageIndex}
            />
          </div>
        </div>
      </div>

      {/* Content area - with background container like MyCandidates */}
      <div className="relative flex-1 min-h-0 bg-white/5 rounded-lg ring-1 ring-inset ring-white/10 backdrop-blur-sm">
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
                onPrefetch={() => onPrefetch?.(app)}
                criteriaCount={criteriaCount}
                isSelectionMode={isSelectionMode}
                isSelected={selectedApplicationIds?.has(app.id)}
                onToggleSelect={() => onToggleSelect?.(app.id)}
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
  const queryClient = useQueryClient();
  const isTouchDevice = useTouchCapable();
  const device = useDevice();
  // Use mobile candidate view on touch devices OR narrow viewports
  const useMobileView = isTouchDevice || device === 'mobile';
  
  // Get kanban layout context for dynamic column widths
  const { setStageCount } = useKanbanLayout();
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  
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
  
  // Swipe viewer state (touch devices)
  const [swipeViewerOpen, setSwipeViewerOpen] = useState(false);
  const [swipeInitialIndex, setSwipeInitialIndex] = useState(0);
  const [swipeStageApps, setSwipeStageApps] = useState<JobApplication[]>([]);
  
  // Track which stage the selected candidate belongs to (for desktop arrow nav)
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<Set<string>>(new Set());
  const [recruiterTooltipOpen, setRecruiterTooltipOpen] = useState(false);
  const recruiterTooltipRef = useRef<HTMLDivElement>(null);

  // Close recruiter tooltip on outside tap (touch devices)
  useEffect(() => {
    if (!recruiterTooltipOpen) return;
    const handler = (e: PointerEvent) => {
      if (recruiterTooltipRef.current && !recruiterTooltipRef.current.contains(e.target as Node)) {
        setRecruiterTooltipOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [recruiterTooltipOpen]);
  
  // Toggle selection of an application
  const toggleApplicationSelection = useCallback((applicationId: string) => {
    setSelectedApplicationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(applicationId)) {
        newSet.delete(applicationId);
      } else {
        newSet.add(applicationId);
      }
      return newSet;
    });
  }, []);
  
  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedApplicationIds(new Set());
  }, []);
  
  // Handle ESC key to exit selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        exitSelectionMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, exitSelectionMode]);

  // Use job-specific stage settings
  const { stageSettings, orderedStages, isLoading: stagesLoading } = useJobStageSettings(jobId);
  
  // Fetch criteria count for this job
  const { data: jobCriteria } = useJobCriteria(jobId || null);
  const criteriaCount = jobCriteria?.length || 0;
  
  // Resolve employer profile image URL
  const employerProfileImageUrl = useMediaUrl(job?.employer_profile?.profile_image_url, 'profile-image');

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

  // Update stage count in layout context for smart sidebar behavior
  useEffect(() => {
    setStageCount(activeStages.length);
  }, [activeStages.length, setStageCount]);

  const collisionDetectionStrategy = useMemo(
    () => columnXCollisionDetection(activeStages),
    [activeStages]
  );

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    // Optimistic update via React Query cache
    updateApplicationLocally(applicationId, { status: newStatus as JobApplication['status'] });

    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId)
        .select('id')
        .maybeSingle();

      if (error) {
        // Refetch on error to restore correct state
        refetch();
        throw error;
      }
      if (!data) {
        refetch();
        throw new Error('Ingen rad uppdaterades');
      }
    } catch (error: any) {
      toast.error('Fel', { description: error.message });
    }
  };

  const updateCandidateRating = async (applicantId: string, newRating: number) => {
    // Check if online first
    if (!navigator.onLine) {
      toast('Offline', { description: 'Du måste vara online för att uppdatera betyg' });
      return;
    }

    const myCandidateId = myCandidatesMap.get(applicantId);
    if (!myCandidateId) {
      toast('Info', { description: 'Lägg först till kandidaten i din lista för att ge betyg' });
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
      toast.error('Fel', { description: 'Kunde inte uppdatera betyg' });
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
      } else {
        // Orphaned candidate (stage deleted) — put in first active stage
        const firstStage = activeStages[0];
        if (firstStage) {
          result[firstStage].push(app);
        }
      }
    });
    return result;
  }, [applications, activeStages]);

  // Get all visible application IDs (for select all)
  const allVisibleApplicationIds = useMemo(() => {
    return applications.map(app => app.id);
  }, [applications]);
  
  // Check if all visible applications are selected
  const allVisibleSelected = useMemo(() => {
    return (
      allVisibleApplicationIds.length > 0 &&
      allVisibleApplicationIds.every((id) => selectedApplicationIds.has(id))
    );
  }, [allVisibleApplicationIds, selectedApplicationIds]);

  // Toggle select all visible applications
  const toggleAllVisible = useCallback(() => {
    setSelectedApplicationIds((prev) => {
      const allSelected =
        allVisibleApplicationIds.length > 0 &&
        allVisibleApplicationIds.every((id) => prev.has(id));

      return allSelected ? new Set() : new Set(allVisibleApplicationIds);
    });
  }, [allVisibleApplicationIds]);

  // Bulk move selected applications to a new stage
  const bulkMoveToStage = async (targetStage: string) => {
    const idsToMove = Array.from(selectedApplicationIds);
    const count = idsToMove.length;
    const targetLabel = stageSettings[targetStage]?.label || targetStage;
    const stageColor = stageSettings[targetStage]?.color || '#22c55e';
    
    // Optimistic update
    idsToMove.forEach(id => {
      updateApplicationLocally(id, { status: targetStage as JobApplication['status'] });
    });
    exitSelectionMode();
    
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: targetStage })
        .in('id', idsToMove);
        
      if (error) throw error;
      toast.success(`${count} kandidater flyttade till "${targetLabel}"`, {
        icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stageColor }} />,
      });
    } catch (error) {
      refetch();
      toast.error('Kunde inte flytta kandidaterna');
    }
  };

  const resolveStageForApplication = useCallback((app: JobApplication): string => {
    const directStage = app.status;
    if ((applicationsByStatus[directStage] || []).some((candidate) => candidate.id === app.id)) {
      return directStage;
    }

    const containingStage = activeStages.find((stageKey) =>
      (applicationsByStatus[stageKey] || []).some((candidate) => candidate.id === app.id)
    );

    return containingStage || directStage;
  }, [applicationsByStatus, activeStages]);

  const handleOpenProfile = useCallback((app: JobApplication) => {
    // Resolve visual stage so navigation always matches what user clicked
    const stage = resolveStageForApplication(app);
    const stageApps = applicationsByStatus[stage] || [];

    if (isTouchDevice) {
      // Touch: open TikTok-style swipe viewer scoped to this stage
      const idx = stageApps.findIndex(a => a.id === app.id);
      setSwipeStageApps(stageApps);
      setSwipeInitialIndex(idx >= 0 ? idx : 0);
      setSwipeViewerOpen(true);
    } else {
      // Desktop/mouse: open dialog with arrow navigation
      setSelectedApplication(app);
      setSelectedStage(stage);
      setDialogOpen(true);
    }
  }, [isTouchDevice, applicationsByStatus, resolveStageForApplication]);

  // Convert JobApplication to ApplicationData for swipe viewer
  const swipeApplicationsAsData = useMemo(() => {
    return swipeStageApps.map(app => ({
      id: app.id,
      job_id: jobId || '',
      applicant_id: app.applicant_id,
      first_name: app.first_name,
      last_name: app.last_name,
      email: app.email,
      phone: app.phone,
      location: app.location,
      bio: app.bio,
      cv_url: app.cv_url,
      age: app.age,
      employment_status: app.employment_status,
      work_schedule: null,
      availability: app.availability,
      custom_answers: app.custom_answers,
      status: app.status,
      applied_at: app.applied_at,
      updated_at: app.applied_at,
      job_title: job?.title || '',
      profile_image_url: app.profile_image_url,
      video_url: app.video_url,
      is_profile_video: app.is_profile_video,
      viewed_at: app.viewed_at,
      last_active_at: app.last_active_at,
      city: app.city,
      rating: app.rating,
    } as ApplicationData));
  }, [swipeStageApps, jobId, job?.title]);

  // Handle opening full profile from swipe viewer
  const handleSwipeOpenFullProfile = useCallback((application: ApplicationData) => {
    setSwipeViewerOpen(false);
    const original = applications.find(a => a.id === application.id);
    if (original) {
      const resolvedStage = resolveStageForApplication(original);
      setSelectedApplication(original);
      setSelectedStage(resolvedStage);
      setDialogOpen(true);
    }
  }, [applications, resolveStageForApplication]);

  const currentNavigationStage = useMemo(() => {
    if (!selectedApplication) return undefined;

    if (
      selectedStage &&
      (applicationsByStatus[selectedStage] || []).some((app) => app.id === selectedApplication.id)
    ) {
      return selectedStage;
    }

    return resolveStageForApplication(selectedApplication);
  }, [selectedApplication, selectedStage, applicationsByStatus, resolveStageForApplication]);

  // Desktop arrow navigation scoped to the current visual stage
  const handleNavigatePrev = useMemo(() => {
    if (!selectedApplication || !currentNavigationStage) return undefined;
    const stageApps = applicationsByStatus[currentNavigationStage] || [];
    const idx = stageApps.findIndex(a => a.id === selectedApplication.id);
    if (idx <= 0) return undefined;
    return () => {
      setSelectedApplication(stageApps[idx - 1]);
    };
  }, [selectedApplication, currentNavigationStage, applicationsByStatus]);

  const handleNavigateNext = useMemo(() => {
    if (!selectedApplication || !currentNavigationStage) return undefined;
    const stageApps = applicationsByStatus[currentNavigationStage] || [];
    const idx = stageApps.findIndex(a => a.id === selectedApplication.id);
    if (idx < 0 || idx >= stageApps.length - 1) return undefined;
    return () => {
      setSelectedApplication(stageApps[idx + 1]);
    };
  }, [selectedApplication, currentNavigationStage, applicationsByStatus]);

  // Candidate index/total for navigation counter
  const candidateNavIndex = useMemo(() => {
    if (!selectedApplication || !currentNavigationStage) return undefined;
    const stageApps = applicationsByStatus[currentNavigationStage] || [];
    const idx = stageApps.findIndex(a => a.id === selectedApplication.id);
    return idx >= 0 ? idx : 0;
  }, [selectedApplication, currentNavigationStage, applicationsByStatus]);

  const candidateNavTotal = useMemo(() => {
    if (!currentNavigationStage) return undefined;
    return (applicationsByStatus[currentNavigationStage] || []).length;
  }, [currentNavigationStage, applicationsByStatus]);

  // Rating helper for swipe viewer
  const getDisplayRating = useCallback((app: ApplicationData) => {
    return app.rating || 0;
  }, []);

  // Prefetch candidate data on hover for instant profile opening
  const handlePrefetchCandidate = useCallback((app: JobApplication) => {
    if (!user || !app.applicant_id) return;
    prefetchCandidateActivities(queryClient, app.applicant_id, user.id);
  }, [user, queryClient]);

  const handleMobileMove = useCallback(async (applicationId: string, newStage: string) => {
    updateApplicationLocally(applicationId, { status: newStage as JobApplication['status'] });
    const stageLabel = stageSettings[newStage]?.label || newStage;
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ status: newStage })
        .eq('id', applicationId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Update didn't affect any rows (RLS block or wrong ID)
        throw new Error('Ingen rad uppdaterades');
      }
      toast.success(`Flyttad till "${stageLabel}"`);
    } catch {
      refetch();
      toast.error('Kunde inte flytta kandidaten');
    }
  }, [updateApplicationLocally, stageSettings, refetch]);

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
       <div className="space-y-4 responsive-container-wide py-4 pb-safe min-h-screen animate-fade-in">
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
            <div key={i} className="flex-1 min-w-[160px] max-w-[240px] flex flex-col">
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
     <div className="space-y-3 md:space-y-4 w-full px-2 md:px-0 py-3 md:py-4 pb-safe min-h-screen animate-fade-in md:max-w-[clamp(20rem,82vw,76rem)] md:mx-auto md:px-[clamp(0.75rem,2.5vw,2rem)]">
        {/* Job Title and Stats - Compact */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 md:p-4 relative z-30">
          {/* Title + close */}
          <div className="flex items-start justify-between gap-2">
            <TruncatedText 
              text={job.title} 
              className="text-lg font-bold text-white flex-1 min-w-0 line-clamp-2"
            />
            <button
              onClick={() => {
                // After hot-reload, history may be empty — fallback to dashboard
                if (window.history.state?.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors shrink-0 focus:outline-none touch-manipulation active:scale-95 relative z-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Location + status + expiry — single row */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm">
            <div className="flex items-center gap-1 text-white">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </div>
            {(() => {
              const isExpired = job.expires_at && new Date(job.expires_at) < new Date();
              const statusLabel = isExpired ? 'Utgången' : (job.is_active ? 'Aktiv' : 'Inaktiv');
              const statusColor = isExpired 
                ? 'bg-red-500/20 text-white border-red-500/30'
                : job.is_active 
                  ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
                  : 'bg-gray-500/20 text-gray-300 border-gray-500/30 hover:bg-gray-500/30';
              
              // Expired jobs: static badge, no toggle
              if (isExpired) {
                return (
                  <Badge className={`text-xs whitespace-nowrap border ${statusColor}`}>
                    {statusLabel}
                  </Badge>
                );
              }

              return (
                <Badge
                  className={`text-xs whitespace-nowrap cursor-pointer transition-colors border ${statusColor}`}
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('job_postings')
                        .update({ is_active: !job.is_active })
                        .eq('id', jobId);

                      if (error) throw error;

                      toast.success(
                        job.is_active ? 'Jobb inaktiverat' : 'Jobb aktiverat',
                        { description: job.is_active ? 'Jobbet är nu inaktivt.' : 'Jobbet är nu aktivt.' }
                      );

                      updateJobLocally({ is_active: !job.is_active });
                      refetch();
                    } catch (error: any) {
                      toast.error('Fel', { description: error.message });
                    }
                  }}
                >
                  {statusLabel}
                </Badge>
              );
            })()}
            {job.expires_at && (
              <span className="text-white text-xs">
                {new Date(job.expires_at) < new Date() 
                  ? `Gick ut ${new Date(job.expires_at).toLocaleDateString('sv-SE')}`
                  : `Går ut ${new Date(job.expires_at).toLocaleDateString('sv-SE')}`
                }
              </span>
            )}
          </div>

          {/* Stats — two rows on mobile, single row on desktop */}
          <div className="mt-3 space-y-1.5 md:space-y-0">
            {/* Row 1: Visningar, Ansökningar, Rekryterare */}
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 min-w-0">
              {/* Visningar */}
              <div className="bg-white/5 rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 min-w-0 overflow-hidden">
                <Eye className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-white text-xs font-medium truncate">{job.views_count}</span>
                <span className="text-white text-xs truncate">Visn.</span>
              </div>

              {/* Ansökningar */}
              <div className="bg-white/5 rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 min-w-0 overflow-hidden">
                <Users className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-white text-xs font-medium truncate">{job.applications_count}</span>
                <span className="text-white text-xs truncate">Ans.</span>
              </div>

              {/* Recruiter avatar */}
              {job.employer_profile ? (
                <TooltipProvider delayDuration={0}>
                  <Tooltip open={recruiterTooltipOpen} onOpenChange={setRecruiterTooltipOpen}>
                    <TooltipTrigger asChild>
                      <div 
                        ref={recruiterTooltipRef}
                        className="bg-white/5 rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 cursor-default min-w-0 overflow-hidden"
                        onClick={() => setRecruiterTooltipOpen(prev => !prev)}
                      >
                        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/60 to-primary overflow-hidden flex items-center justify-center text-[10px] text-white font-medium shrink-0">
                          {employerProfileImageUrl ? (
                            <img src={employerProfileImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            `${job.employer_profile.first_name?.[0] || ''}${job.employer_profile.last_name?.[0] || ''}`
                          )}
                        </div>
                        <span className="text-white text-xs truncate max-w-[60px]">
                          {job.employer_profile.first_name}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rekryterare: {job.employer_profile.first_name} {job.employer_profile.last_name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <div className="bg-white/5 rounded-lg px-2 py-1.5 min-w-0" />
              )}

              {/* Desktop-only: show row 2 items inline */}
              <button
                onClick={() => applications.length > 0 ? (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)) : undefined}
                onMouseDown={(e) => e.preventDefault()}
                className={`hidden md:flex rounded-lg px-2 py-1.5 items-center justify-center gap-1 outline-none focus:outline-none transition-all duration-200 min-w-0 overflow-hidden ${
                  isSelectionMode 
                    ? 'bg-white/10 ring-1 ring-white hover:bg-white/15' 
                    : applications.length > 0 
                      ? 'bg-white/5 hover:bg-white/10' 
                      : 'bg-white/5 opacity-40 cursor-default'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-white text-xs font-medium">{isSelectionMode ? 'Avbryt' : 'Välj'}</span>
              </button>
              <div className="hidden md:flex min-w-0">
                <JobQrCodeButton jobId={jobId!} jobTitle={job.title} />
              </div>
            </div>

            {/* Row 2 (mobile only): Välj, QR */}
            <div className="grid grid-cols-2 gap-1.5 min-w-0 md:hidden">
              <button
                onClick={() => applications.length > 0 ? (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)) : undefined}
                onMouseDown={(e) => e.preventDefault()}
                className={`rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 outline-none focus:outline-none transition-all duration-200 ring-1 min-w-0 overflow-hidden ${
                  isSelectionMode 
                    ? 'bg-white/10 ring-white' 
                    : applications.length > 0 
                      ? 'bg-white/5 ring-white/30' 
                      : 'bg-white/5 ring-white/20 opacity-40 cursor-default'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-white text-xs font-medium">Välj</span>
              </button>

              <JobQrCodeButton jobId={jobId!} jobTitle={job.title} />
            </div>
          </div>
        </div>

        {/* Touch devices: tab-based candidate list. Desktop: kanban with drag-and-drop */}
        {useMobileView ? (
          <MobileCandidateView
            jobId={jobId || ''}
            applications={applications}
            stages={activeStages}
            stageSettings={stageSettings}
            criteriaCount={criteriaCount}
            onOpenProfile={handleOpenProfile}
            onMoveToStage={handleMobileMove}
            onMarkAsViewed={markApplicationAsViewed}
            onOpenCriteriaDialog={() => setCriteriaDialogOpen(true)}
            isSelectionMode={isSelectionMode}
            selectedApplicationIds={selectedApplicationIds}
            onToggleSelect={(id) => setSelectedApplicationIds(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
            renderActionBar={isSelectionMode ? (
              <div className="animate-in slide-in-from-bottom-4 duration-300 flex justify-center mt-2">
                <div className="flex items-center gap-1.5 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-3 py-2 shadow-xl overflow-hidden min-w-0 max-w-full">
                  <span className="text-white text-xs font-medium whitespace-nowrap flex-shrink-0">
                    {selectedApplicationIds.size}/{allVisibleApplicationIds.length} valda
                  </span>
                  <div className="w-px h-4 bg-white/20 flex-shrink-0" />
                  <button
                    onClick={toggleAllVisible}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex items-center justify-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 w-[90px] text-white outline-none focus:outline-none transition-all duration-200 rounded-md"
                  >
                    {allVisibleSelected ? <Square className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
                    {allVisibleSelected ? 'Avmarkera' : 'Välj alla'}
                  </button>
                  <div className="w-px h-4 bg-white/20 flex-shrink-0" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        disabled={selectedApplicationIds.size === 0}
                        onMouseDown={(e) => e.preventDefault()}
                        className={`flex items-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 outline-none focus:outline-none transition-all duration-200 rounded-md ${
                          selectedApplicationIds.size === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white'
                        }`}
                      >
                        <ArrowDown className="h-3.5 w-3.5 mr-1" />
                        Flytta till
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="border-white/20 min-w-[180px]">
                      {activeStages.map(stage => {
                        const settings = stageSettings[stage];
                        const Icon = getJobStageIconByName(settings?.iconName || 'inbox');
                        return (
                          <DropdownMenuItem 
                            key={stage}
                            onClick={() => bulkMoveToStage(stage)}
                            className="text-white hover:text-white cursor-pointer"
                          >
                            <div className="h-2 w-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: settings?.color || '#0EA5E9' }} />
                            <Icon className="h-4 w-4 mr-2 text-white/70" />
                            <span className="truncate">{settings?.label || stage}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ) : undefined}
          />
        ) : (
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
               ref={dragScrollRef}
               className="flex gap-3 pb-4 pt-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30" 
               style={{ 
                 height: 'calc(100vh - 300px)',
                 overflowY: 'hidden',
                 WebkitOverflowScrolling: 'touch',
               }}
            >
              {activeStages.map((status, stageIndex) => {
                const config = stageSettings[status] || { label: status, color: '#0EA5E9', iconName: 'inbox', isCustom: false };
                // Target stage for move-on-delete: next stage, or previous if last
                const targetIdx = stageIndex < activeStages.length - 1 ? stageIndex + 1 : stageIndex - 1;
                const targetKey = targetIdx >= 0 ? activeStages[targetIdx] : undefined;
                const targetLabel = targetKey ? (stageSettings[targetKey]?.label || targetKey) : undefined;
                
                return (
                  <StatusColumn 
                    key={status}
                    jobId={jobId || ''}
                    status={status}
                    applications={applicationsByStatus[status] || []}
                    onOpenProfile={handleOpenProfile}
                    onMarkAsViewed={markApplicationAsViewed}
                    onPrefetch={handlePrefetchCandidate}
                    onOpenCriteriaDialog={stageIndex === 0 ? () => setCriteriaDialogOpen(true) : undefined}
                    stageConfig={config}
                    totalStageCount={activeStages.length}
                    stageIndex={stageIndex}
                    criteriaCount={criteriaCount}
                    isSelectionMode={isSelectionMode}
                    selectedApplicationIds={selectedApplicationIds}
                    onToggleSelect={toggleApplicationSelection}
                    targetStageKey={targetKey}
                    targetStageLabel={targetLabel}
                    onMoveCandidatesAndDelete={targetKey ? async () => {
                      // Move all candidates from this stage to target stage
                      const apps = applicationsByStatus[status] || [];
                      if (apps.length > 0) {
                        const ids = apps.map(a => a.id);
                        ids.forEach(id => updateApplicationLocally(id, { status: targetKey as JobApplication['status'] }));
                        const { error } = await supabase
                          .from('job_applications')
                          .update({ status: targetKey })
                          .in('id', ids);
                        if (error) {
                          refetch();
                          throw error;
                        }
                      }
                    } : undefined}
                  />
                );
              })}
              {activeStages.length < 8 && (
                <div className="flex-shrink-0 flex items-start pt-1">
                  <CreateJobStageDialog 
                    jobId={jobId || ''}
                    currentStageCount={activeStages.length}
                    trigger={
                      <button className="px-3 py-1.5 text-xs font-medium rounded-full transition-all text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center gap-1.5 border border-white/20">
                        <Plus className="h-3.5 w-3.5" />
                        Nytt steg
                      </button>
                    }
                  />
                </div>
              )}
            </div>

            <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
              {activeApplication ? (
                <div className="opacity-95 pointer-events-none">
                  <ApplicationCardContent application={activeApplication} isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

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
            city: (selectedApplication as any).city || null,
          } as ApplicationData : null}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTimeout(() => {
                setSelectedApplication(null);
                setSelectedStage(null);
              }, 300);
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
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          candidateIndex={candidateNavIndex}
          candidateTotal={candidateNavTotal}
        />

        {/* TikTok-style Swipe Viewer for touch devices */}
        {isTouchDevice && (
          <CandidateSwipeViewer
            applications={swipeApplicationsAsData}
            initialIndex={swipeInitialIndex}
            open={swipeViewerOpen}
            onClose={() => setSwipeViewerOpen(false)}
            onOpenFullProfile={handleSwipeOpenFullProfile}
            getDisplayRating={getDisplayRating}
          />
        )}

        {/* Selection Criteria Dialog */}
        {jobId && (
          <SelectionCriteriaDialog
            open={criteriaDialogOpen}
            onOpenChange={setCriteriaDialogOpen}
            jobId={jobId}
            candidates={applications.map(app => ({ 
              applicant_id: app.applicant_id, 
              application_id: app.id 
            }))}
            onActivate={() => {
              refetch();
            }}
          />
        )}

        {/* Floating Action Bar for Selection Mode — desktop only (mobile uses inline bar in MobileCandidateView) */}
        {isSelectionMode && (
          <div className="hidden md:flex fixed bottom-6 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300 px-4 justify-center">
            <div className="flex items-center gap-1.5 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-3 py-2 shadow-xl overflow-hidden min-w-0 max-w-full">
              <span className="text-white text-xs font-medium whitespace-nowrap flex-shrink-0">
                {selectedApplicationIds.size}/{allVisibleApplicationIds.length} valda
              </span>
              <div className="w-px h-4 bg-white/20 flex-shrink-0" />
              <button
                onClick={toggleAllVisible}
                onMouseDown={(e) => e.preventDefault()}
                className="flex items-center justify-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 w-[90px] text-white md:hover:bg-white/10 outline-none focus:outline-none transition-all duration-200 rounded-md"
              >
                {allVisibleSelected ? <Square className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
                {allVisibleSelected ? 'Avmarkera' : 'Välj alla'}
              </button>
              <div className="w-px h-4 bg-white/20 flex-shrink-0" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={selectedApplicationIds.size === 0}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`flex items-center px-2 h-8 text-xs whitespace-nowrap flex-shrink-0 outline-none focus:outline-none md:hover:bg-white/10 md:hover:text-white transition-all duration-200 rounded-md ${
                      selectedApplicationIds.size === 0 ? 'text-white/30 cursor-not-allowed' : 'text-white'
                    }`}
                  >
                    <ArrowDown className="h-3.5 w-3.5 mr-1" />
                    Flytta till
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="border-white/20 min-w-[180px]">
                  {activeStages.map(stage => {
                    const settings = stageSettings[stage];
                    const Icon = getJobStageIconByName(settings?.iconName || 'inbox');
                    return (
                      <DropdownMenuItem 
                        key={stage}
                        onClick={() => bulkMoveToStage(stage)}
                        className="text-white hover:text-white cursor-pointer"
                      >
                        <div 
                          className="h-2 w-2 rounded-full mr-2 flex-shrink-0" 
                          style={{ backgroundColor: settings?.color || '#0EA5E9' }} 
                        />
                        <Icon className="h-4 w-4 mr-2 text-white/70" />
                        <span className="truncate">{settings?.label || stage}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
  );
};

export default JobDetails;
