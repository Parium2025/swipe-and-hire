import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MyCandidateData, useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useKanbanLayout } from '@/hooks/useKanbanLayout';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCvSummaryPreloader } from '@/hooks/useCvSummaryPreloader';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useColleagueCandidates } from '@/hooks/useColleagueCandidates';
import { useColleagueStageSettings } from '@/hooks/useColleagueStageSettings';
import { prefetchCandidateActivities } from '@/hooks/useCandidateActivities';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { 
  Trash2, 
  Phone, 
  Calendar, 
  UserCheck,
  Gift,
  PartyPopper,
  Search,
  X,
  Star,
  ArrowDown,
  Clock,
  Play,
  Plus,
  Users,
  ChevronDown,
  Eye,
  AlertTriangle,
  CheckSquare,
  Square
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TeamMemberAvatar } from '@/components/TeamMemberAvatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
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
import { useStageSettings, getIconByName, DEFAULT_STAGE_KEYS, CandidateStage } from '@/hooks/useStageSettings';
import { StageSettingsMenu } from '@/components/StageSettingsMenu';
import { CreateStageDialog } from '@/components/CreateStageDialog';
import { smartSearchCandidates } from '@/lib/smartSearch';


interface CandidateCardProps {
  candidate: MyCandidateData;
  onRemove: () => void;
  onOpenProfile: () => void;
  onPrefetch?: () => void;
  isDragging?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

// Star rating component - read-only for cards
const StarRating = ({ 
  rating = 0, 
  maxStars = 5, 
}: { 
  rating?: number; 
  maxStars?: number; 
}) => {
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

// Wrapper component for CandidateAvatar with inline video playback
const SmallCandidateAvatar = ({ candidate }: { candidate: MyCandidateData }) => {
  const hasVideo = candidate.is_profile_video && candidate.video_url;
  
  return (
    <div 
      className="h-8 w-8 flex-shrink-0 [&>*:first-child]:h-8 [&>*:first-child]:w-8 [&_.h-10]:h-8 [&_.w-10]:w-8 [&_.ring-2]:ring-1"
      onClick={hasVideo ? (e) => {
        // Prevent opening profile dialog when clicking on video - let ProfileVideo handle playback
        e.stopPropagation();
      } : undefined}
    >
      <CandidateAvatar
        profileImageUrl={candidate.profile_image_url}
        videoUrl={candidate.video_url}
        isProfileVideo={candidate.is_profile_video}
        firstName={candidate.first_name}
        lastName={candidate.last_name}
        stopPropagation={!!hasVideo}
      />
    </div>
  );
};

const CandidateCardContent = ({ 
  candidate, 
  onRemove, 
  onOpenProfile,
  onPrefetch,
  isDragging,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: CandidateCardProps) => {
  const initials = `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase() || '?';
  const isUnread = !candidate.viewed_at;
  const latestApplicationTime = formatCompactTime(candidate.latest_application_at);
  const lastActiveTime = formatCompactTime(candidate.last_active_at);
  
  const handleClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
    } else {
      onOpenProfile();
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
      {/* Selection checkbox - shows in selection mode */}
      {isSelectionMode && (
        <div className="absolute left-1 top-1 z-10">
          <Checkbox 
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            className="h-3.5 w-3.5 border border-white/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-white hover:border-white/70"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      
      {/* Unread indicator dot - shows if application hasn't been viewed */}
      {isUnread && !isSelectionMode && (
        <div className="absolute right-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}
      
      <div className={`flex items-center gap-2 ${isSelectionMode ? 'ml-5' : ''}`}>
        <SmallCandidateAvatar candidate={candidate} />
        
        <div className="flex-1 min-w-0 pr-4">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-fuchsia-400 font-medium text-xs truncate group-hover:text-fuchsia-300 transition-colors cursor-default">
                  {candidate.first_name} {candidate.last_name}
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{candidate.first_name} {candidate.last_name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <StarRating rating={candidate.rating} />
          {(latestApplicationTime || lastActiveTime) && (
            <div className="flex items-center gap-1.5 mt-0.5 max-w-full text-white text-[9px] leading-none">
              {latestApplicationTime && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-default whitespace-nowrap">
                        <ArrowDown className="h-2.5 w-2.5 shrink-0 text-white" strokeWidth={3} />
                        {latestApplicationTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p>Senaste ansökan i organisationen</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {lastActiveTime && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-default whitespace-nowrap">
                        <Clock className="h-2.5 w-2.5 shrink-0 text-white" strokeWidth={3} />
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


      {/* Remove button - shows on hover with smooth animation (hidden in selection mode) */}
      {!isSelectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-1 top-1 p-1 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-full
            opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// Sortable wrapper for the card - entire card is draggable (disabled in selection mode)
const SortableCandidateCard = (props: CandidateCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: props.candidate.id,
    disabled: props.isSelectionMode, // Disable drag in selection mode
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition, // No transition while dragging to avoid flicker
    opacity: isDragging ? 0 : 1, // Fully hide while dragging (DragOverlay shows the visual)
  };

  // In selection mode, don't apply drag listeners
  const dragProps = props.isSelectionMode ? {} : { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style} {...dragProps}>
      <CandidateCardContent 
        {...props} 
        isDragging={isDragging}
      />
    </div>
  );
};

interface StageColumnProps {
  stage: CandidateStage;
  candidates: MyCandidateData[];
  onMoveCandidate: (id: string, stage: CandidateStage) => void;
  onRemoveCandidate: (candidate: MyCandidateData) => void;
  onOpenProfile: (candidate: MyCandidateData) => void;
  onPrefetch?: (candidate: MyCandidateData) => void;
  stageSettings: { label: string; color: string; iconName: string };
  isReadOnly?: boolean;
  totalStageCount: number;
  targetStageKey: string; // Stage to move candidates to when deleting
  targetStageLabel: string;
  onMoveCandidatesAndDelete: (fromStage: string, toStage: string) => Promise<void>;
  // Selection mode props
  isSelectionMode?: boolean;
  selectedCandidateIds?: Set<string>;
  onToggleSelect?: (candidateId: string) => void;
  
}

const StageColumn = ({ 
  stage, 
  candidates, 
  onMoveCandidate, 
  onRemoveCandidate, 
  onOpenProfile,
  onPrefetch,
  stageSettings, 
  isReadOnly, 
  totalStageCount, 
  targetStageKey, 
  targetStageLabel, 
  onMoveCandidatesAndDelete,
  isSelectionMode,
  selectedCandidateIds,
  onToggleSelect,
  
}: Omit<StageColumnProps, 'isOver'>) => {
  const Icon = getIconByName(stageSettings.iconName);
  const [liveColor, setLiveColor] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use useDroppable's own isOver for accurate column-level detection
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    disabled: isReadOnly,
  });

  // Use live color while dragging, fall back to saved color
  const displayColor = liveColor ?? stageSettings.color;

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

  // Check scroll on mount and when candidates change
  useEffect(() => {
    checkScroll();
  }, [candidates.length, checkScroll]);

  return (
    <div 
      ref={setNodeRef}
      className="flex-none w-[calc((100%-3rem)/5)] flex flex-col transition-colors h-full min-w-0"
    >
      <div 
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-white/20 backdrop-blur-sm flex-shrink-0 ${isOver ? 'ring-2 ring-white/40' : ''}`}
        style={{ backgroundColor: `${displayColor}33` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-xs text-white truncate cursor-default flex-1 min-w-0">{stageSettings.label}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{stageSettings.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span 
            className="text-white text-[10px] h-4 min-w-4 px-1 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: `${displayColor}66` }}
          >
            {candidates.length}
          </span>
          {/* Only show settings menu for own list */}
          {!isReadOnly && (
            <div className="ml-auto">
              <StageSettingsMenu 
                stageKey={stage} 
                candidateCount={candidates.length}
                totalStageCount={totalStageCount}
                targetStageKey={targetStageKey}
                targetStageLabel={targetStageLabel}
                onMoveCandidatesAndDelete={onMoveCandidatesAndDelete}
                onLiveColorChange={setLiveColor}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content area - with background container like Teamtailor but Parium style */}
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

          <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {candidates.map(candidate => (
              <SortableCandidateCard
                key={candidate.id}
                candidate={candidate}
                onRemove={() => onRemoveCandidate(candidate)}
                onOpenProfile={() => onOpenProfile(candidate)}
                onPrefetch={onPrefetch ? () => onPrefetch(candidate) : undefined}
                isSelectionMode={isSelectionMode}
                isSelected={selectedCandidateIds?.has(candidate.id)}
                onToggleSelect={() => onToggleSelect?.(candidate.id)}
              />
            ))}
          </SortableContext>

          {candidates.length === 0 && !isOver && (
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

const MyCandidates = () => {
  const { user } = useAuth();
  const { stageConfig, stageOrder, deleteStage } = useStageSettings();
  const { setStageCount } = useKanbanLayout();
  
  // Team members for colleague switching
  const { teamMembers, hasTeam, isLoading: loadingTeam } = useTeamMembers();
  
  // State for viewing a colleague's list
  const [viewingColleagueId, setViewingColleagueId] = useState<string | null>(null);
  const viewingColleague = teamMembers.find(m => m.userId === viewingColleagueId);
  const isViewingColleague = !!viewingColleagueId;
  
  // Colleague's candidates and stage settings
  const { 
    candidates: colleagueCandidates, 
    isLoading: loadingColleagueCandidates,
    fetchColleagueCandidates,
    moveCandidateInColleagueList,
    removeCandidateFromColleagueList,
    setCandidates: setColleagueCandidates,
  } = useColleagueCandidates(viewingColleagueId);
  
  const { 
    stageConfig: colleagueStageConfig, 
    stageOrder: colleagueStageOrder,
  } = useColleagueStageSettings(viewingColleagueId);
  
  // Use colleague's settings when viewing their list
  const activeStageConfig = isViewingColleague ? colleagueStageConfig : stageConfig;
  const activeStageOrder = isViewingColleague ? colleagueStageOrder : stageOrder;
  
  // Update stage count in layout context for smart sidebar behavior
  useEffect(() => {
    setStageCount(activeStageOrder.length);
  }, [activeStageOrder.length, setStageCount]);
  
  // Search state with debounced version for FTS
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // Debounce search query for FTS (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Use the hook with debounced search for FTS
  const {
    candidates: hookCandidates,
    isLoading: hookLoading,
    refetch: refetchCandidates,
    moveCandidate: hookMoveCandidate,
    removeCandidate: hookRemoveCandidate,
    updateNotes: hookUpdateNotes,
    updateRating: hookUpdateRating,
  } = useMyCandidatesData(debouncedSearchQuery);
  
  // Sync candidates from hook to local state (needed for optimistic updates)
  // Initialize with hook values to prevent initial flicker
  const [candidates, setCandidates] = useState<MyCandidateData[]>(() => hookCandidates);
  const [isLoading, setIsLoading] = useState(() => hookLoading);
  
  // Sync candidates from hook when they change
  useEffect(() => {
    setCandidates(hookCandidates);
    setIsLoading(hookLoading);
  }, [hookCandidates, hookLoading]);
  
  // Minimum delay for smooth fade-in animation (prevents jarring instant appearance when cached)
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);
  
  // Active candidates to display
  const displayedCandidates = isViewingColleague ? colleagueCandidates : candidates;
  
  const [selectedCandidate, setSelectedCandidate] = useState<MyCandidateData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [allCandidateApplications, setAllCandidateApplications] = useState<ApplicationData[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState<MyCandidateData | null>(null);
  
  // Filter state
  const [activeStageFilter, setActiveStageFilter] = useState<string | 'all'>('all');
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // Toggle selection of a candidate
  const toggleCandidateSelection = useCallback((candidateId: string) => {
    setSelectedCandidateIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  }, []);
  
  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedCandidateIds(new Set());
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
  
  // Get selected candidates data
  const selectedCandidates = useMemo(() => {
    return displayedCandidates.filter(c => selectedCandidateIds.has(c.id));
  }, [displayedCandidates, selectedCandidateIds]);
  
  // Bulk move selected candidates to a new stage
  const bulkMoveToStage = async (targetStage: CandidateStage) => {
    const idsToMove = Array.from(selectedCandidateIds);
    const count = idsToMove.length;
    const targetLabel = activeStageConfig[targetStage]?.label || targetStage;
    
    const stageColor = activeStageConfig[targetStage]?.color || '#22c55e';
    
    if (isViewingColleague) {
      // Move in colleague's list
      for (const id of idsToMove) {
        await moveCandidateInColleagueList(id, targetStage);
      }
      exitSelectionMode();
      toast.success(`${count} kandidater flyttade till "${targetLabel}"`, {
        icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stageColor }} />,
      });
      return;
    }
    
    // Optimistic update
    setCandidates(prev => prev.map(c => 
      selectedCandidateIds.has(c.id) ? { ...c, stage: targetStage } : c
    ));
    exitSelectionMode();
    
    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ stage: targetStage, updated_at: new Date().toISOString() })
        .in('id', idsToMove);
        
      if (error) throw error;
      toast.success(`${count} kandidater flyttade till "${targetLabel}"`, {
        icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stageColor }} />,
      });
    } catch (error) {
      fetchCandidates();
      toast.error('Kunde inte flytta kandidaterna');
    }
  };
  
  // Bulk delete selected candidates
  const confirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedCandidateIds);
    
    if (isViewingColleague) {
      // Remove from colleague's list one by one
      for (const id of idsToDelete) {
        await removeCandidateFromColleagueList(id);
      }
      exitSelectionMode();
      setShowBulkDeleteConfirm(false);
      toast.success(`${idsToDelete.length} kandidater borttagna`);
      return;
    }
    
    // Optimistic remove
    setCandidates(prev => prev.filter(c => !selectedCandidateIds.has(c.id)));
    exitSelectionMode();
    setShowBulkDeleteConfirm(false);
    
    try {
      const { error } = await supabase
        .from('my_candidates')
        .delete()
        .in('id', idsToDelete);
        
      if (error) throw error;
      toast.success(`${idsToDelete.length} kandidater borttagna från din lista`);
    } catch (error) {
      // Refetch on error
      fetchCandidates();
      toast.error('Kunde inte ta bort kandidaterna');
    }
  };
  
  
  
  // Fetch colleague's candidates when switching
  useEffect(() => {
    if (viewingColleagueId) {
      fetchColleagueCandidates();
    }
  }, [viewingColleagueId, fetchColleagueCandidates]);

  // fetchCandidates is now handled by useMyCandidatesData hook
  // Just create a reference for compatibility
  const fetchCandidates = refetchCandidates;

  // Förladda CV-sammanfattningar i bakgrunden
  useCvSummaryPreloader(displayedCandidates);

  // Group candidates by stage (computed from local state) - dynamic for custom stages
  const candidatesByStage = useMemo(() => {
    const grouped: Record<string, MyCandidateData[]> = {};
    
    // Initialize with all known stages from active stage order
    activeStageOrder.forEach(stageKey => {
      grouped[stageKey] = [];
    });

    displayedCandidates.forEach(candidate => {
      if (!grouped[candidate.stage]) {
        grouped[candidate.stage] = [];
      }
      grouped[candidate.stage].push(candidate);
    });

    return grouped;
  }, [displayedCandidates, activeStageOrder]);

  // Stats
  const stats = useMemo(() => {
    const stageStats: Record<string, number> = {};
    activeStageOrder.forEach(stage => {
      stageStats[stage] = candidatesByStage[stage]?.length || 0;
    });
    return {
      total: displayedCandidates.length,
      ...stageStats,
    };
  }, [displayedCandidates, candidatesByStage, activeStageOrder]);

  // Filter candidates based on search query and stage filter
  // FTS already filters at database level (debouncedSearchQuery), so we only use smartSearch
  // for instant local filtering while typing (before debounce triggers)
  const filteredCandidatesByStage = useMemo(() => {
    const query = searchQuery.trim();
    const debouncedQuery = debouncedSearchQuery.trim();
    
    const filterCandidates = (stageKey: string) => {
      const stageCandidates = candidatesByStage[stageKey] || [];
      if (!query) return stageCandidates;
      
      // If FTS has already filtered with same query, no need for local filtering
      if (query === debouncedQuery) return stageCandidates;
      
      // Use smart search for instant local filtering while user types
      // This gives responsive feedback before FTS kicks in (300ms debounce)
      return smartSearchCandidates(stageCandidates, query);
    };

    const filtered: Record<string, MyCandidateData[]> = {};
    activeStageOrder.forEach(stage => {
      filtered[stage] = filterCandidates(stage);
    });
    return filtered;
  }, [candidatesByStage, searchQuery, debouncedSearchQuery, activeStageOrder]);

  // Get total filtered count
  const filteredTotal = useMemo(() => {
    return Object.values(filteredCandidatesByStage).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredCandidatesByStage]);

  // Get all visible/filtered candidate IDs (for select all)
  const allVisibleCandidateIds = useMemo(() => {
    const ids: string[] = [];
    Object.values(filteredCandidatesByStage).forEach(candidates => {
      candidates.forEach(c => ids.push(c.id));
    });
    return ids;
  }, [filteredCandidatesByStage]);
  
  // Check if all visible candidates are selected
  const allVisibleSelected = useMemo(() => {
    return (
      allVisibleCandidateIds.length > 0 &&
      allVisibleCandidateIds.every((id) => selectedCandidateIds.has(id))
    );
  }, [allVisibleCandidateIds, selectedCandidateIds]);

  // Toggle select all visible candidates (keeps the same button mounted to avoid focus flicker)
  const toggleAllVisible = useCallback(() => {
    setSelectedCandidateIds((prev) => {
      const allSelected =
        allVisibleCandidateIds.length > 0 &&
        allVisibleCandidateIds.every((id) => prev.has(id));

      return allSelected ? new Set() : new Set(allVisibleCandidateIds);
    });
  }, [allVisibleCandidateIds]);

  // Stages to display based on filter
  const stagesToDisplay = useMemo(() => {
    if (activeStageFilter === 'all') return activeStageOrder;
    return [activeStageFilter];
  }, [activeStageFilter, activeStageOrder]);

  // Fetch all applications for the selected candidate when dialog opens
  useEffect(() => {
    const fetchAllApplications = async () => {
      if (!selectedCandidate || !user || !dialogOpen) {
        setAllCandidateApplications([]);
        return;
      }

      setLoadingApplications(true);
      try {
        const { data: orgJobs, error: jobsError } = await supabase
          .from('job_postings')
          .select('id, title, employer_id')
          .eq('employer_id', user.id);

        if (jobsError) throw jobsError;
        if (!orgJobs || orgJobs.length === 0) {
          setAllCandidateApplications([]);
          return;
        }

        const jobIds = orgJobs.map(j => j.id);

        const { data: applications, error: appError } = await supabase
          .from('job_applications')
          .select(`
            id,
            job_id,
            applicant_id,
            first_name,
            last_name,
            email,
            phone,
            location,
            bio,
            cv_url,
            age,
            employment_status,
            work_schedule,
            availability,
            custom_answers,
            status,
            applied_at,
            updated_at,
            job_postings!inner(title)
          `)
          .eq('applicant_id', selectedCandidate.applicant_id)
          .in('job_id', jobIds);

        if (appError) throw appError;

        const transformedApps: ApplicationData[] = (applications || []).map(app => ({
          id: app.id,
          job_id: app.job_id,
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
          work_schedule: app.work_schedule,
          availability: app.availability,
          custom_answers: app.custom_answers,
          status: app.status,
          applied_at: app.applied_at || '',
          updated_at: app.updated_at,
          job_title: (app.job_postings as any)?.title || 'Okänt jobb',
          profile_image_url: selectedCandidate.profile_image_url,
          video_url: selectedCandidate.video_url,
          is_profile_video: selectedCandidate.is_profile_video,
        }));

        setAllCandidateApplications(transformedApps);
      } catch (error) {
        console.error('Error fetching candidate applications:', error);
        setAllCandidateApplications([]);
      } finally {
        setLoadingApplications(false);
      }
    };

    fetchAllApplications();
  }, [selectedCandidate?.applicant_id, user?.id, dialogOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection - stable column selection based on pointer X-position
  const collisionDetectionStrategy = useMemo(
    () => columnXCollisionDetection(stagesToDisplay),
    [stagesToDisplay]
  );

  const activeCandidate = useMemo(() => {
    if (!activeId) return null;
    return displayedCandidates.find(c => c.id === activeId) || null;
  }, [activeId, displayedCandidates]);

  // Resolve which stage we're hovering over (works for both column and card hovers)
  const resolveOverStage = (overRawId?: string): string | null => {
    if (!overRawId) return null;

    if (activeStageOrder.includes(overRawId)) {
      return overRawId;
    }

    const overCandidate = displayedCandidates.find((c) => c.id === overRawId);
    if (overCandidate && activeStageOrder.includes(overCandidate.stage)) {
      return overCandidate.stage;
    }

    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overRawId = event.over?.id as string | undefined;
    const stage = resolveOverStage(overRawId);
    setOverId(stage);
  };

  // Move candidate - OPTIMISTIC UPDATE like JobDetails
  const updateCandidateStage = async (candidateId: string, newStage: CandidateStage) => {
    if (isViewingColleague) {
      // Use colleague mutation
      await moveCandidateInColleagueList(candidateId, newStage);
      return;
    }
    
    // Optimistic update - move card immediately
    const previousCandidates = [...candidates];
    setCandidates(prev => prev.map(c => 
      c.id === candidateId 
        ? { ...c, stage: newStage } 
        : c
    ));

    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ stage: newStage })
        .eq('id', candidateId);

      if (error) {
        // Revert on error
        setCandidates(previousCandidates);
        throw error;
      }
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte flytta kandidaten');
    }
  };

  // Move all candidates from one stage to another and delete the stage
  const handleMoveCandidatesAndDelete = useCallback(async (fromStage: string, toStage: string) => {
    if (!user) return;
    
    // Get all candidate IDs in the source stage
    const candidatesToMove = candidates.filter(c => c.stage === fromStage);
    
    if (candidatesToMove.length > 0) {
      // Optimistic update - move all candidates immediately
      const previousCandidates = [...candidates];
      setCandidates(prev => prev.map(c => 
        c.stage === fromStage 
          ? { ...c, stage: toStage } 
          : c
      ));

      try {
        // Update all candidates in database
        const candidateIds = candidatesToMove.map(c => c.id);
        const { error } = await supabase
          .from('my_candidates')
          .update({ stage: toStage })
          .in('id', candidateIds);

        if (error) {
          // Revert on error
          setCandidates(previousCandidates);
          throw error;
        }
      } catch (error: any) {
        toast.error(error.message || 'Kunde inte flytta kandidaterna');
        return;
      }
    }

    // Now delete the stage
    await deleteStage.mutateAsync(fromStage);
  }, [user, candidates, deleteStage]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const candidateId = active.id as string;
    const overRawId = over.id as string;
    const targetStage = resolveOverStage(overRawId);

    if (!targetStage) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const candidate = displayedCandidates.find(c => c.id === candidateId);
    if (candidate && candidate.stage !== targetStage) {
      // Update stage FIRST (optimistic update)
      updateCandidateStage(candidateId, targetStage);
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

  const handleMoveCandidate = (id: string, stage: CandidateStage) => {
    updateCandidateStage(id, stage);
  };

  const handleRemoveCandidate = (candidate: MyCandidateData) => {
    setCandidateToRemove(candidate);
  };

  const confirmRemoveCandidate = async () => {
    if (candidateToRemove) {
      const idToRemove = candidateToRemove.id;
      
      if (isViewingColleague) {
        await removeCandidateFromColleagueList(idToRemove);
        setCandidateToRemove(null);
        return;
      }
      
      // Optimistic remove
      setCandidates(prev => prev.filter(c => c.id !== idToRemove));
      setCandidateToRemove(null);
      
      try {
        const { error } = await supabase
          .from('my_candidates')
          .delete()
          .eq('id', idToRemove);
          
        if (error) throw error;
        toast.success('Kandidat borttagen från din lista');
      } catch (error) {
        // Refetch on error
        fetchCandidates();
        toast.error('Kunde inte ta bort kandidaten');
      }
    }
  };

  // Update rating - optimistic
  const updateCandidateRating = async (candidateId: string, newRating: number) => {
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, rating: newRating } : c
    ));
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate(prev => prev ? { ...prev, rating: newRating } : null);
    }

    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ rating: newRating })
        .eq('id', candidateId);
        
      if (error) throw error;
    } catch (error) {
      fetchCandidates();
      toast.error('Kunde inte uppdatera betyg');
    }
  };

  // Mark as viewed - optimistic
  const markApplicationAsViewed = async (applicationId: string) => {
    setCandidates(prev => prev.map(c => 
      c.application_id === applicationId 
        ? { ...c, viewed_at: new Date().toISOString() } 
        : c
    ));

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

  const handleOpenProfile = (candidate: MyCandidateData) => {
    setSelectedCandidate(candidate);
    setDialogOpen(true);
    
    // Mark as viewed if not already
    if (!candidate.viewed_at) {
      markApplicationAsViewed(candidate.application_id);
      setSelectedCandidate(prev => prev ? { ...prev, viewed_at: new Date().toISOString() } : null);
    }
  };

  // Query client for prefetching
  const queryClient = useQueryClient();
  
  // Prefetch candidate data on hover for instant profile opening
  const handlePrefetchCandidate = useCallback((candidate: MyCandidateData) => {
    if (!user || !candidate.applicant_id) return;
    
    // Prefetch activities
    prefetchCandidateActivities(queryClient, candidate.applicant_id, user.id);
    
    // Prefetch persistent notes
    queryClient.prefetchQuery({
      queryKey: ['candidate-notes', candidate.applicant_id],
      queryFn: async () => {
        const { data } = await supabase
          .from('candidate_notes')
          .select('*')
          .eq('applicant_id', candidate.applicant_id)
          .is('job_id', null);
        return data || [];
      },
      staleTime: 30 * 1000,
    });
  }, [user, queryClient]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => setSelectedCandidate(null), 300);
  };

  // Convert MyCandidateData to ApplicationData format for dialog
  const selectedApplicationData = useMemo(() => {
    if (!selectedCandidate) return null;
    return {
      id: selectedCandidate.application_id,
      job_id: selectedCandidate.job_id || '',
      applicant_id: selectedCandidate.applicant_id,
      first_name: selectedCandidate.first_name,
      last_name: selectedCandidate.last_name,
      email: selectedCandidate.email,
      phone: selectedCandidate.phone,
      location: selectedCandidate.location,
      bio: selectedCandidate.bio,
      cv_url: selectedCandidate.cv_url,
      age: selectedCandidate.age,
      employment_status: selectedCandidate.employment_status,
      work_schedule: selectedCandidate.work_schedule,
      availability: selectedCandidate.availability,
      custom_answers: selectedCandidate.custom_answers,
      status: selectedCandidate.status,
      applied_at: selectedCandidate.applied_at,
      updated_at: selectedCandidate.updated_at,
      job_title: selectedCandidate.job_title || 'Okänt jobb',
      profile_image_url: selectedCandidate.profile_image_url,
      video_url: selectedCandidate.video_url,
      is_profile_video: selectedCandidate.is_profile_video,
    };
  }, [selectedCandidate]);

  if (isLoading || !showContent) {
    return (
       <div className="max-w-4xl mx-auto px-3 md:px-8 opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
     <div className="max-w-4xl mx-auto px-3 md:px-8 animate-fade-in">
      {/* Header with Search and Stage Filters */}
      <div className="mb-6 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 md:p-4">
        {/* Title and description */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2">
            {hasTeam ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-xl md:text-2xl font-semibold text-white tracking-tight hover:text-white/80 transition-colors">
                    {isViewingColleague ? (
                      <>
                        <Eye className="h-5 w-5 text-fuchsia-400" />
                        {viewingColleague?.firstName} {viewingColleague?.lastName}s kandidater
                      </>
                    ) : (
                      <>Mina kandidater</>
                    )}
                    <span className="text-white/60">({stats.total})</span>
                    <ChevronDown className="h-4 w-4 text-white/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="bg-card-parium border-white/20 min-w-[200px]">
                  <DropdownMenuItem 
                    onClick={() => setViewingColleagueId(null)}
                    className={`text-white hover:text-white ${!isViewingColleague ? 'bg-white/10' : ''}`}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Mina kandidater
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <div className="px-2 py-1.5 text-xs text-white/50 font-medium">Kollegors listor</div>
                  {teamMembers.map(member => (
                    <DropdownMenuItem 
                      key={member.userId}
                      onClick={() => setViewingColleagueId(member.userId)}
                      className={`text-white hover:text-white ${viewingColleagueId === member.userId ? 'bg-white/10' : ''}`}
                    >
                      <TeamMemberAvatar
                        profileImageUrl={member.profileImageUrl}
                        firstName={member.firstName}
                        lastName={member.lastName}
                        size="xs"
                        className="mr-2"
                      />
                      {member.firstName} {member.lastName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
                Mina kandidater ({stats.total})
              </h1>
            )}
          </div>
          <p className="text-sm text-white/90 mt-1">
            {isViewingColleague 
              ? `Visar ${viewingColleague?.firstName}s rekryteringspipeline - du kan flytta och ta bort kandidater`
              : 'Din personliga rekryteringspipeline - dra kandidater mellan steg'
            }
          </p>
        </div>

        {/* Search and Stage Filters */}
        {stats.total > 0 && (
          <div className="space-y-3">
            {/* Search input and Select button */}
            <div className="flex items-center gap-2 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
              <Input
                placeholder="Sök på namn, jobb eller anteckningar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-white/5 border-white/20 text-white placeholder:text-white focus:border-white/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Select mode toggle button (single button to prevent focus flicker) */}
            <Button
              variant="glass"
              size="sm"
              onClick={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
              className="h-8 px-3 text-xs"
            >
              {isSelectionMode ? null : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
              {isSelectionMode ? 'Avbryt' : 'Välj'}
            </Button>
          </div>

          {/* Stage filters */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setActiveStageFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                activeStageFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white hover:bg-white/10 hover:text-white'
              }`}
            >
              Alla ({stats.total})
            </button>
            {activeStageOrder.map(stage => {
              const settings = activeStageConfig[stage];
              const count = candidatesByStage[stage]?.length || 0;
              const isActive = activeStageFilter === stage;
              const label = settings?.label || '';
              const isTruncated = label.length > 20;
              
              const buttonContent = (
                <button
                  key={stage}
                  onClick={() => setActiveStageFilter(isActive ? 'all' : stage)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full transition-all text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm max-w-[200px] min-w-0 inline-flex items-center gap-1"
                  style={{
                    backgroundColor: isActive ? `${settings?.color}66` : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <span className="truncate min-w-0">{label}</span>
                  <span className="flex-shrink-0">({count})</span>
                </button>
              );
              
              if (!isTruncated) {
                return <React.Fragment key={stage}>{buttonContent}</React.Fragment>;
              }
              
              return (
                <TooltipProvider key={stage} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {buttonContent}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{label} ({count})</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
            
          </div>

          {/* Search results info */}
          {searchQuery && (
            filteredTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
                  <Search className="h-5 w-5 text-white/60" />
                </div>
                <p className="text-white font-medium text-sm">Inga kandidater hittades</p>
                <p className="text-white/60 text-xs mt-1 text-center max-w-xs">
                  Försök med ett annat sökord eller kontrollera stavningen
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Rensa sökning
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-white">
                Visar {filteredTotal} av {stats.total} kandidater
              </p>
            )
          )}
        </div>
        )}
      </div>

      {stats.total === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserCheck className="h-12 w-12 text-white mb-4" />
            <p className="text-white text-center">
              Du har inga kandidater i din lista än.
            </p>
            <p className="text-white text-sm text-center mt-2">
              Gå till <span className="font-medium">Kandidater</span> och lägg till kandidater du vill arbeta med.
            </p>
          </CardContent>
        </Card>
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
            className={`flex gap-3 pb-4 pt-2 w-full ${activeStageFilter !== 'all' ? 'justify-center' : ''}`} 
            style={{ 
              height: 'calc(100vh - 300px)',
              overflowX: 'hidden',
              overflowY: 'hidden',
            }}
          >
            {stagesToDisplay.map((stage, index) => {
              // Calculate target stage for moving candidates when deleting this stage
              // If this is the first stage, move to second stage; otherwise move to first stage
              const stageIndex = activeStageOrder.indexOf(stage);
              const targetIndex = stageIndex === 0 ? 1 : 0;
              const targetKey = activeStageOrder[targetIndex] || activeStageOrder[0];
              const targetLabel = activeStageConfig[targetKey]?.label || 'Nästa steg';
              
              return (
                <StageColumn
                  key={stage}
                  stage={stage}
                  candidates={filteredCandidatesByStage[stage] || []}
                  onMoveCandidate={handleMoveCandidate}
                  onRemoveCandidate={handleRemoveCandidate}
                  onOpenProfile={handleOpenProfile}
                  onPrefetch={handlePrefetchCandidate}
                  stageSettings={activeStageConfig[stage] || { label: stage, color: '#6366F1', iconName: 'flag' }}
                  isReadOnly={isViewingColleague}
                  totalStageCount={activeStageOrder.length}
                  targetStageKey={targetKey}
                  targetStageLabel={targetLabel}
                  onMoveCandidatesAndDelete={handleMoveCandidatesAndDelete}
                  isSelectionMode={isSelectionMode}
                  selectedCandidateIds={selectedCandidateIds}
                  onToggleSelect={toggleCandidateSelection}
                  
                />
              );
            })}
            {/* Nytt steg button - inline with columns, only show if less than max stages */}
            {!isViewingColleague && activeStageOrder.length < 5 && activeStageFilter === 'all' && (
              <div className="flex-none w-[calc((100%-3rem)/5)] flex items-start pt-1">
                <CreateStageDialog 
                  currentStageCount={activeStageOrder.length}
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
            {activeCandidate ? (
              <div className="opacity-95 pointer-events-none">
                <CandidateCardContent
                  candidate={activeCandidate}
                  onRemove={() => {}}
                  onOpenProfile={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Candidate Profile Dialog */}
      <CandidateProfileDialog
        application={selectedApplicationData as any}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => {}}
        allApplications={allCandidateApplications.length > 1 ? allCandidateApplications : undefined}
        candidateRating={selectedCandidate?.rating}
        onRatingChange={(rating) => {
          if (selectedCandidate) {
            updateCandidateRating(selectedCandidate.id, rating);
          }
        }}
        currentStage={selectedCandidate?.stage}
        stageOrder={activeStageOrder}
        stageConfig={activeStageConfig}
        onStageChange={(newStage) => {
          const stageColor = activeStageConfig[newStage]?.color || '#22c55e';
          const stageLabel = activeStageConfig[newStage]?.label || newStage;
          
          if (selectedCandidate && !isViewingColleague) {
            // Move candidate to new stage
            handleMoveCandidate(selectedCandidate.id, newStage);
            // Update local state
            setSelectedCandidate(prev => prev ? { ...prev, stage: newStage } : null);
            toast.success(`Flyttade till ${stageLabel}`, {
              icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stageColor }} />,
            });
          } else if (selectedCandidate && isViewingColleague) {
            moveCandidateInColleagueList(selectedCandidate.id, newStage);
            setSelectedCandidate(prev => prev ? { ...prev, stage: newStage } : null);
            toast.success(`Flyttade till ${stageLabel}`, {
              icon: <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stageColor }} />,
            });
          }
        }}
        onRemoveFromList={() => {
          if (selectedCandidate) {
            // Use the existing remove logic
            setCandidateToRemove(selectedCandidate);
            // Close the dialog first
            setDialogOpen(false);
            // Then trigger the confirm
            setTimeout(() => {
              confirmRemoveCandidate();
            }, 100);
          }
        }}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!candidateToRemove} onOpenChange={(open) => !open && setCandidateToRemove(null)}>
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
                "{candidateToRemove?.first_name} {candidateToRemove?.last_name}"
              </span>
              ? Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setCandidateToRemove(null)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveCandidate}
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort {selectedCandidateIds.size} kandidater
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              Är du säker på att du vill ta bort {selectedCandidateIds.size} valda kandidater? Denna åtgärd går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setShowBulkDeleteConfirm(false)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort alla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      {/* Floating Action Bar for Selection Mode */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 bg-[#1a2a3a]/90 backdrop-blur-xl border border-white/15 rounded-full px-4 py-2 shadow-2xl">
            <span className="text-white text-sm font-medium whitespace-nowrap">
              {selectedCandidateIds.size} av {allVisibleCandidateIds.length} valda
            </span>
            <div className="w-px h-5 bg-white/20" />
            
            {/* Select All / Deselect All toggle (single mounted button to prevent flicker) */}
            <Button
              variant="glass"
              size="sm"
              onClick={toggleAllVisible}
              className="h-8 px-3 text-xs"
            >
              {allVisibleSelected ? (
                <Square className="h-3.5 w-3.5 mr-1" />
              ) : (
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
              )}
              {allVisibleSelected ? 'Avmarkera alla' : 'Välj alla'}
            </Button>

            <div className="w-px h-5 bg-white/20" />

            {/* Move to stage dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="glass"
                  size="sm"
                  disabled={selectedCandidateIds.size === 0}
                  aria-disabled={selectedCandidateIds.size === 0}
                  className="h-8 px-3 text-xs"
                >
                  <ArrowDown className="h-3.5 w-3.5 mr-1" />
                  Flytta till
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="border-white/20 min-w-[180px]">
                {activeStageOrder.map(stage => {
                  const settings = activeStageConfig[stage];
                  const Icon = getIconByName(settings?.iconName || 'flag');
                  return (
                    <DropdownMenuItem 
                      key={stage}
                      onClick={() => bulkMoveToStage(stage)}
                      className="text-white hover:text-white cursor-pointer"
                    >
                      <div 
                        className="h-2 w-2 rounded-full mr-2 flex-shrink-0" 
                        style={{ backgroundColor: settings?.color || '#6366F1' }} 
                      />
                      <Icon className="h-4 w-4 mr-2 text-white/70" />
                      <span className="truncate">{settings?.label || stage}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="glassRed"
              size="sm"
              disabled={selectedCandidateIds.size === 0}
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="h-8 px-3 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Ta bort
            </Button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MyCandidates;
