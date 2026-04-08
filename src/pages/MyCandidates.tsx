import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MyCandidateData, useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useKanbanLayout } from '@/hooks/useKanbanLayout';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { CandidateSwipeViewer } from '@/components/candidates/CandidateSwipeViewer';
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
import { useSelectionMode } from '@/hooks/useSelectionMode';
import { useBulkCandidateOps } from '@/hooks/useBulkCandidateOps';
import { 
  UserCheck,
  Plus,
} from 'lucide-react';
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

// ── Extracted components ─────────────────────────────
import { CandidateCardContent } from '@/components/candidates/KanbanCandidateCard';
import { StageColumn } from '@/components/candidates/StageColumn';
import { MobileMyCandidatesView } from '@/components/candidates/MobileMyCandidatesView';
import { useDevice } from '@/hooks/use-device';
import { MyCandidatesHeader } from '@/pages/myCandidates/MyCandidatesHeader';
import { MyCandidatesDesktopActionBar } from '@/pages/myCandidates/MyCandidatesDesktopActionBar';
import { MyCandidatesMobileActionBar } from '@/pages/myCandidates/MyCandidatesMobileActionBar';
import { RemoveCandidateDialog, BulkDeleteDialog } from '@/pages/myCandidates/MyCandidatesDialogs';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { MyCandidatesSkeleton } from '@/components/skeletons/PageSkeletons';

const MyCandidates = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const device = useDevice();
  const isTouchDevice = useTouchCapable();
  const useMobileView = device === 'mobile';
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
    candidates,
    isLoading,
    refetch: refetchCandidates,
    moveCandidate: hookMoveCandidate,
    removeCandidate: hookRemoveCandidate,
    updateNotes: hookUpdateNotes,
    updateRating: hookUpdateRating,
    markAsViewed: hookMarkAsViewed,
  } = useMyCandidatesData(debouncedSearchQuery);

  // updateCandidatesCache is now provided by useBulkCandidateOps hook

  // Minimum delay for smooth fade-in
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);
  
  // Active candidates to display (hook already deduplicates by applicant_id)
  const displayedCandidates = useMemo(() => {
    return isViewingColleague ? colleagueCandidates : candidates;
  }, [isViewingColleague, colleagueCandidates, candidates]);
  
  const [selectedCandidate, setSelectedCandidate] = useState<MyCandidateData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [candidateToRemove, setCandidateToRemove] = useState<MyCandidateData | null>(null);

  // Swipe viewer state — continuous scroll navigation
  const [swipeViewerOpen, setSwipeViewerOpen] = useState(false);
  const [swipeInitialIndex, setSwipeInitialIndex] = useState(0);
  const [swipeStageCandidates, setSwipeStageCandidates] = useState<MyCandidateData[]>([]);
  
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
  
  // Bulk action confirmation dialogs
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
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

  // Selection mode (extracted hook)
  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedCandidateIds,
    toggleCandidateSelection,
    exitSelectionMode,
    allVisibleSelected,
    toggleAllVisible,
  } = useSelectionMode(allVisibleCandidateIds);



  // Bulk operations (extracted hook — with retry queue)
  const { bulkMoveToStage, bulkDelete, updateCandidatesCache } = useBulkCandidateOps({
    debouncedSearchQuery,
    stageConfig: activeStageConfig,
    isViewingColleague,
    moveCandidateInColleagueList,
    removeCandidateFromColleagueList,
    exitSelectionMode,
    selectedCandidateIds,
    displayedCandidates,
  });

  const confirmBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    await bulkDelete();
  };

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

  // Move candidate - delegates to hook mutation (includes retry queue + optimistic update)
  const updateCandidateStage = async (candidateId: string, newStage: CandidateStage) => {
    if (isViewingColleague) {
      await moveCandidateInColleagueList(candidateId, newStage);
      return;
    }
    hookMoveCandidate.mutate({ id: candidateId, stage: newStage });
  };

  const handleMoveCandidatesAndDelete = useCallback(async (fromStage: string, toStage: string) => {
    if (!user) return;
    
    const candidatesToMove = candidates.filter(c => c.stage === fromStage);
    
    if (candidatesToMove.length > 0) {
      const previousData = queryClient.getQueryData(['my-candidates', user?.id, debouncedSearchQuery]);
      updateCandidatesCache(items =>
        items.map(c => c.stage === fromStage ? { ...c, stage: toStage } : c)
      );

      try {
        const candidateIds = candidatesToMove.map(c => c.id);
        const { error } = await supabase
          .from('my_candidates')
          .update({ stage: toStage })
          .in('id', candidateIds);

        if (error) {
          queryClient.setQueryData(['my-candidates', user?.id, debouncedSearchQuery], previousData);
          throw error;
        }
      } catch (error: any) {
        toast.error(error.message || 'Kunde inte flytta kandidaterna');
        return;
      }
    }

    await deleteStage.mutateAsync(fromStage);
  }, [user, candidates, deleteStage, queryClient, debouncedSearchQuery, updateCandidatesCache]);

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
        setSwipeViewerOpen(false);
        setCandidateToRemove(null);
        return;
      }
      
      setSwipeViewerOpen(false);
      setCandidateToRemove(null);
      hookRemoveCandidate.mutate(idToRemove);
    }
  };

  // Update rating - delegates to hook mutation (includes retry queue + optimistic update)
  const updateCandidateRating = async (candidateId: string, newRating: number) => {
    const candidate = displayedCandidates.find(c => c.id === candidateId);
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate(prev => prev ? { ...prev, rating: newRating } : null);
    }
    hookUpdateRating.mutate({
      id: candidateId,
      rating: newRating,
      applicantId: candidate?.applicant_id,
    });
  };

  // Mark as viewed - delegates to hook mutation
  const markApplicationAsViewed = async (applicationId: string) => {
    hookMarkAsViewed.mutate(applicationId);
  };

  const handleOpenProfile = useCallback((candidate: MyCandidateData) => {
    if (isTouchDevice) {
      // Touch: continuous vertical scroll viewer
      const stageCandidates = filteredCandidatesByStage[candidate.stage] || [];
      const idx = stageCandidates.findIndex(c => c.id === candidate.id);
      setSwipeStageCandidates(stageCandidates);
      setSwipeInitialIndex(idx >= 0 ? idx : 0);
      setSwipeViewerOpen(true);
    } else {
      // Mouse: open profile dialog
      setSelectedCandidate(candidate);
      setDialogOpen(true);
    }

    if (!candidate.viewed_at) {
      markApplicationAsViewed(candidate.application_id);
    }
  }, [filteredCandidatesByStage, markApplicationAsViewed, isTouchDevice]);

  // Prefetching
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

  // ── Arrow navigation within same stage (mouse/desktop) ──
  const handleNavigatePrev = useMemo(() => {
    if (!selectedCandidate) return undefined;
    const stageCandidates = filteredCandidatesByStage[selectedCandidate.stage] || [];
    const idx = stageCandidates.findIndex(c => c.id === selectedCandidate.id);
    if (idx <= 0) return undefined;
    return () => {
      const prev = stageCandidates[idx - 1];
      setSelectedCandidate(prev);
      if (!prev.viewed_at) markApplicationAsViewed(prev.application_id);
    };
  }, [selectedCandidate, filteredCandidatesByStage, markApplicationAsViewed]);

  const handleNavigateNext = useMemo(() => {
    if (!selectedCandidate) return undefined;
    const stageCandidates = filteredCandidatesByStage[selectedCandidate.stage] || [];
    const idx = stageCandidates.findIndex(c => c.id === selectedCandidate.id);
    if (idx < 0 || idx >= stageCandidates.length - 1) return undefined;
    return () => {
      const next = stageCandidates[idx + 1];
      setSelectedCandidate(next);
      if (!next.viewed_at) markApplicationAsViewed(next.application_id);
    };
  }, [selectedCandidate, filteredCandidatesByStage, markApplicationAsViewed]);

  const candidateNavIndex = useMemo(() => {
    if (!selectedCandidate) return undefined;
    const stageCandidates = filteredCandidatesByStage[selectedCandidate.stage] || [];
    const idx = stageCandidates.findIndex(c => c.id === selectedCandidate.id);
    return idx >= 0 ? idx : 0;
  }, [selectedCandidate, filteredCandidatesByStage]);

  const candidateNavTotal = useMemo(() => {
    if (!selectedCandidate) return undefined;
    return (filteredCandidatesByStage[selectedCandidate.stage] || []).length;
  }, [selectedCandidate, filteredCandidatesByStage]);

  /** Map MyCandidateData → ApplicationData for CandidateSwipeViewer / Dialog */
  const mapCandidateToAppData = useCallback((c: MyCandidateData): ApplicationData => ({
    id: c.application_id,
    job_id: c.job_id || '',
    applicant_id: c.applicant_id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone,
    location: c.location,
    bio: c.bio,
    cv_url: c.cv_url,
    age: c.age,
    employment_status: c.employment_status,
    work_schedule: c.work_schedule,
    availability: c.availability,
    custom_answers: c.custom_answers,
    status: c.status,
    applied_at: c.applied_at || c.created_at,
    updated_at: c.updated_at,
    job_title: c.job_title || 'Okänt jobb',
    profile_image_url: c.profile_image_url,
    video_url: c.video_url,
    is_profile_video: c.is_profile_video,
    viewed_at: c.viewed_at,
    last_active_at: c.last_active_at,
    rating: c.rating,
  }), []);

  // Applications for the swipe viewer
  const swipeApplicationsData = useMemo(() => {
    return swipeStageCandidates.map(mapCandidateToAppData);
  }, [swipeStageCandidates, mapCandidateToAppData]);

  // When user taps "open full profile" from swipe viewer → open dialog
  const handleSwipeOpenFullProfile = useCallback((application: ApplicationData) => {
    setSwipeViewerOpen(false);
    const original = displayedCandidates.find(c => c.application_id === application.id);
    if (original) {
      setSelectedCandidate(original);
      setDialogOpen(true);
    }
  }, [displayedCandidates]);

  const getDisplayRating = useCallback((app: ApplicationData) => app.rating || 0, []);

  // Convert MyCandidateData to ApplicationData format for dialog
  const selectedApplicationData = useMemo(() => {
    if (!selectedCandidate) return null;
    return mapCandidateToAppData(selectedCandidate);
  }, [selectedCandidate, mapCandidateToAppData]);

  if (isLoading || !showContent) {
    return <MyCandidatesSkeleton />;
  }

  return (
     <div className="responsive-container-wide animate-fade-in">
      {/* Header with Search and Stage Filters */}
      <MyCandidatesHeader
        totalCount={stats.total}
        filteredTotal={filteredTotal}
        candidatesByStage={candidatesByStage}
        hasTeam={hasTeam}
        teamMembers={teamMembers}
        isViewingColleague={isViewingColleague}
        viewingColleague={viewingColleague}
        viewingColleagueId={viewingColleagueId}
        onViewColleague={setViewingColleagueId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={() => displayedCandidates.length > 0 ? (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)) : undefined}
        displayedCandidatesCount={displayedCandidates.length}
        activeStageFilter={activeStageFilter}
        onStageFilterChange={setActiveStageFilter}
        stageOrder={activeStageOrder}
        stageConfig={activeStageConfig}
        useMobileView={useMobileView}
      />

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
      ) : useMobileView ? (
        <MobileMyCandidatesView
          candidates={displayedCandidates}
          stages={activeStageOrder}
          stageConfig={activeStageConfig}
          onOpenProfile={handleOpenProfile}
          onMoveToStage={(id, stage) => updateCandidateStage(id, stage)}
          onMoveCandidatesAndDelete={handleMoveCandidatesAndDelete}
          isReadOnly={isViewingColleague}
          isSelectionMode={isSelectionMode}
          selectedCandidateIds={selectedCandidateIds}
          onToggleSelect={toggleCandidateSelection}
          onPrefetch={handlePrefetchCandidate}
          onMarkAsViewed={markApplicationAsViewed}
          renderActionBar={isSelectionMode ? (
            <MyCandidatesMobileActionBar
              selectedCount={selectedCandidateIds.size}
              totalVisibleCount={allVisibleCandidateIds.length}
              allVisibleSelected={allVisibleSelected}
              onToggleAllVisible={toggleAllVisible}
              stageOrder={activeStageOrder}
              stageConfig={activeStageConfig}
              onBulkMoveToStage={bulkMoveToStage}
              onBulkDeleteClick={() => setShowBulkDeleteConfirm(true)}
            />
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

      {/* Swipe Viewer — continuous scroll navigation */}
      <CandidateSwipeViewer
        applications={swipeApplicationsData}
        initialIndex={swipeInitialIndex}
        open={swipeViewerOpen}
        onClose={() => setSwipeViewerOpen(false)}
        onOpenFullProfile={handleSwipeOpenFullProfile}
        getDisplayRating={getDisplayRating}
        onRemoveCandidate={(app) => {
          const original = displayedCandidates.find(c => c.application_id === app.id);
          if (original) {
            handleRemoveCandidate(original);
          }
        }}
      />

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
            const candidateToDelete = selectedCandidate;
            setDialogOpen(false);
            setTimeout(() => {
              if (isViewingColleague) {
                removeCandidateFromColleagueList(candidateToDelete.id);
                return;
              }
              hookRemoveCandidate.mutate(candidateToDelete.id);
            }, 100);
          }
        }}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        candidateIndex={candidateNavIndex}
        candidateTotal={candidateNavTotal}
      />

      {/* Remove Confirmation Dialog */}
      <RemoveCandidateDialog
        candidate={candidateToRemove}
        onOpenChange={() => setCandidateToRemove(null)}
        onConfirm={confirmRemoveCandidate}
        onCancel={() => setCandidateToRemove(null)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteConfirm}
        selectedCount={selectedCandidateIds.size}
        onOpenChange={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
      />

      {/* Floating Action Bar for Selection Mode — desktop only */}
      {isSelectionMode && (
        <MyCandidatesDesktopActionBar
          selectedCount={selectedCandidateIds.size}
          totalVisibleCount={allVisibleCandidateIds.length}
          allVisibleSelected={allVisibleSelected}
          onToggleAllVisible={toggleAllVisible}
          stageOrder={activeStageOrder}
          stageConfig={activeStageConfig}
          onBulkMoveToStage={bulkMoveToStage}
          onBulkDeleteClick={() => setShowBulkDeleteConfirm(true)}
        />
      )}




    </div>
  );
};

export default MyCandidates;

