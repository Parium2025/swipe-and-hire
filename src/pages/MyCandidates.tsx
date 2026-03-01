import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MyCandidateData, useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useKanbanLayout } from '@/hooks/useKanbanLayout';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useMyCandidateApplications } from '@/hooks/useMyCandidateApplications';
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
  UserCheck,
  Search,
  X,
  ArrowDown,
  Plus,
  Users,
  ChevronDown,
  Eye,
  AlertTriangle,
  CheckSquare,
  Square
} from 'lucide-react';
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
  MeasuringStrategy,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { columnXCollisionDetection } from '@/lib/dnd/columnCollisionDetection';
import { useStageSettings, getIconByName, CandidateStage } from '@/hooks/useStageSettings';
import { CreateStageDialog } from '@/components/CreateStageDialog';
import { smartSearchCandidates } from '@/lib/smartSearch';
import { CandidateCompareDialog } from '@/components/CandidateCompareDialog';

// ── Extracted components ─────────────────────────────
import { CandidateCardContent } from '@/components/candidates/KanbanCandidateCard';
import { StageColumn } from '@/components/candidates/StageColumn';

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
  const [candidates, setCandidates] = useState<MyCandidateData[]>(() => hookCandidates);
  const [isLoading, setIsLoading] = useState(() => hookLoading);
  
  useEffect(() => {
    setCandidates(hookCandidates);
    setIsLoading(hookLoading);
  }, [hookCandidates, hookLoading]);
  
  // Minimum delay for smooth fade-in
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
  const [candidateToRemove, setCandidateToRemove] = useState<MyCandidateData | null>(null);
  
  // ── Centralized application fetching ─────────────────
  const candidateFallback = useMemo(() => selectedCandidate ? {
    profile_image_url: selectedCandidate.profile_image_url,
    video_url: selectedCandidate.video_url,
    is_profile_video: selectedCandidate.is_profile_video,
  } : undefined, [selectedCandidate?.profile_image_url, selectedCandidate?.video_url, selectedCandidate?.is_profile_video]);

  const { allApplications: allCandidateApplications, loading: loadingApplications } =
    useMyCandidateApplications(
      selectedCandidate?.applicant_id || null,
      dialogOpen,
      candidateFallback
    );
  
  // Filter state
  const [activeStageFilter, setActiveStageFilter] = useState<string | 'all'>('all');
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  
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

  const fetchCandidates = refetchCandidates;

  // Preload CV summaries
  useCvSummaryPreloader(displayedCandidates);

  // Group candidates by stage
  const candidatesByStage = useMemo(() => {
    const grouped: Record<string, MyCandidateData[]> = {};
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
  const filteredCandidatesByStage = useMemo(() => {
    const query = searchQuery.trim();
    const debouncedQuery = debouncedSearchQuery.trim();
    
    const filterCandidates = (stageKey: string) => {
      const stageCandidates = candidatesByStage[stageKey] || [];
      if (!query) return stageCandidates;
      if (query === debouncedQuery) return stageCandidates;
      return smartSearchCandidates(stageCandidates, query);
    };

    const filtered: Record<string, MyCandidateData[]> = {};
    activeStageOrder.forEach(stage => {
      filtered[stage] = filterCandidates(stage);
    });
    return filtered;
  }, [candidatesByStage, searchQuery, debouncedSearchQuery, activeStageOrder]);

  const filteredTotal = useMemo(() => {
    return Object.values(filteredCandidatesByStage).reduce((sum, arr) => sum + arr.length, 0);
  }, [filteredCandidatesByStage]);

  const allVisibleCandidateIds = useMemo(() => {
    const ids: string[] = [];
    Object.values(filteredCandidatesByStage).forEach(candidates => {
      candidates.forEach(c => ids.push(c.id));
    });
    return ids;
  }, [filteredCandidatesByStage]);
  
  const allVisibleSelected = useMemo(() => {
    return (
      allVisibleCandidateIds.length > 0 &&
      allVisibleCandidateIds.every((id) => selectedCandidateIds.has(id))
    );
  }, [allVisibleCandidateIds, selectedCandidateIds]);

  const toggleAllVisible = useCallback(() => {
    setSelectedCandidateIds((prev) => {
      const allSelected =
        allVisibleCandidateIds.length > 0 &&
        allVisibleCandidateIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allVisibleCandidateIds);
    });
  }, [allVisibleCandidateIds]);

  const stagesToDisplay = useMemo(() => {
    if (activeStageFilter === 'all') return activeStageOrder;
    return [activeStageFilter];
  }, [activeStageFilter, activeStageOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const collisionDetectionStrategy = useMemo(
    () => columnXCollisionDetection(stagesToDisplay),
    [stagesToDisplay]
  );

  const activeCandidate = useMemo(() => {
    if (!activeId) return null;
    return displayedCandidates.find(c => c.id === activeId) || null;
  }, [activeId, displayedCandidates]);

  const resolveOverStage = (overRawId?: string): string | null => {
    if (!overRawId) return null;
    if (activeStageOrder.includes(overRawId)) return overRawId;
    const overCandidate = displayedCandidates.find((c) => c.id === overRawId);
    if (overCandidate && activeStageOrder.includes(overCandidate.stage)) return overCandidate.stage;
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overRawId = event.over?.id as string | undefined;
    setOverId(resolveOverStage(overRawId));
  };

  // Move candidate - OPTIMISTIC UPDATE
  const updateCandidateStage = async (candidateId: string, newStage: CandidateStage) => {
    if (isViewingColleague) {
      await moveCandidateInColleagueList(candidateId, newStage);
      return;
    }
    
    const previousCandidates = [...candidates];
    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, stage: newStage } : c
    ));

    try {
      const { error } = await supabase
        .from('my_candidates')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', candidateId);

      if (error) {
        setCandidates(previousCandidates);
        throw error;
      }
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte flytta kandidaten');
    }
  };

  const handleMoveCandidatesAndDelete = useCallback(async (fromStage: string, toStage: string) => {
    if (!user) return;
    
    const candidatesToMove = candidates.filter(c => c.stage === fromStage);
    
    if (candidatesToMove.length > 0) {
      const previousCandidates = [...candidates];
      setCandidates(prev => prev.map(c => 
        c.stage === fromStage ? { ...c, stage: toStage } : c
      ));

      try {
        const candidateIds = candidatesToMove.map(c => c.id);
        const { error } = await supabase
          .from('my_candidates')
          .update({ stage: toStage })
          .in('id', candidateIds);

        if (error) {
          setCandidates(previousCandidates);
          throw error;
        }
      } catch (error: any) {
        toast.error(error.message || 'Kunde inte flytta kandidaterna');
        return;
      }
    }

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
      updateCandidateStage(candidateId, targetStage);
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
    
    if (!candidate.viewed_at) {
      markApplicationAsViewed(candidate.application_id);
      setSelectedCandidate(prev => prev ? { ...prev, viewed_at: new Date().toISOString() } : null);
    }
  };

  // Query client for prefetching
  const queryClient = useQueryClient();
  
  const handlePrefetchCandidate = useCallback((candidate: MyCandidateData) => {
    if (!user || !candidate.applicant_id) return;
    
    prefetchCandidateActivities(queryClient, candidate.applicant_id, user.id);
    
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
       <div className="responsive-container-wide opacity-0">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  return (
     <div className="responsive-container-wide animate-fade-in">
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
              const targetIndex = index === 0 ? 1 : 0;
              const targetStage = stagesToDisplay[targetIndex] || stagesToDisplay[0];
              const settings = activeStageConfig[stage];
              
              return (
                <StageColumn
                  key={stage}
                  stage={stage}
                  candidates={filteredCandidatesByStage[stage] || []}
                  onRemoveCandidate={handleRemoveCandidate}
                  onOpenProfile={handleOpenProfile}
                  onPrefetch={handlePrefetchCandidate}
                  stageSettings={{
                    label: settings?.label || stage,
                    color: settings?.color || '#6366F1',
                    iconName: settings?.iconName || 'flag',
                  }}
                  isReadOnly={isViewingColleague}
                  totalStageCount={activeStageOrder.length}
                  targetStageKey={targetStage}
                  targetStageLabel={activeStageConfig[targetStage]?.label || targetStage}
                  onMoveCandidatesAndDelete={handleMoveCandidatesAndDelete}
                  isSelectionMode={isSelectionMode}
                  selectedCandidateIds={selectedCandidateIds}
                  onToggleSelect={toggleCandidateSelection}
                />
              );
            })}

            {/* Add Stage button */}
            {!isViewingColleague && activeStageFilter === 'all' && (
              <div className="flex-none w-[calc((100%-3rem)/5)] flex flex-col h-full min-w-0">
              <CreateStageDialog
                  trigger={
                    <button className="w-full rounded-md px-2 py-1.5 mb-2 ring-1 ring-inset ring-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 text-white text-xs font-medium flex-shrink-0">
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
            handleMoveCandidate(selectedCandidate.id, newStage);
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
            setCandidateToRemove(selectedCandidate);
            setDialogOpen(false);
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

            {/* Compare button - only when exactly 2 selected */}
            {selectedCandidateIds.size === 2 && (
              <>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setShowCompareDialog(true)}
                  className="h-8 px-3 text-xs"
                >
                  <Users className="h-3.5 w-3.5 mr-1" />
                  Jämför
                </Button>
                <div className="w-px h-5 bg-white/20" />
              </>
            )}

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

      {/* Candidate Compare Dialog */}
      <CandidateCompareDialog
        candidates={selectedCandidates.slice(0, 2)}
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        stageConfig={activeStageConfig}
      />

    </div>
  );
};

export default MyCandidates;
