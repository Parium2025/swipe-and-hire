import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePullToDismiss } from '@/hooks/usePullToDismiss';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { prefetchCandidateActivities } from '@/hooks/useCandidateActivities';
import { prefetchCandidateNotes } from '@/hooks/useCandidateNotes';
import { getIsOnline } from '@/lib/connectivityManager';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { useDevice } from '@/hooks/use-device';
import { MobileCandidateView } from '@/components/MobileCandidateView';
import { CandidateSwipeViewer } from '@/components/candidates/CandidateSwipeViewer';
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useCandidatePageWarmup } from '@/hooks/useCandidatePageWarmup';

import { ApplicationData } from '@/hooks/useApplicationsData';
import { SelectionCriteriaDialog } from '@/components/SelectionCriteriaDialog';
import { useJobStageSettings, DEFAULT_JOB_STAGE_KEYS } from '@/hooks/useJobStageSettings';
import { useJobDetailsData, type JobApplication } from '@/hooks/useJobDetailsData';
import { useJobCriteria } from '@/hooks/useCriteriaResults';
import { useKanbanLayout } from '@/hooks/useKanbanLayout';
import { useSelectionMode } from '@/hooks/useSelectionMode';
import { Plus } from 'lucide-react';
import { SectionErrorBoundary } from '@/components/candidateProfile';
import { toast } from 'sonner';
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

// Extracted sub-components
import {
  SelectionActionBar,
  ApplicationCardContent,
  StatusColumn,
  mapToApplicationData,
  JobDetailsSkeleton,
  JobDetailsHeader,
} from '@/components/jobdetails';

const JobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isTouchDevice = useTouchCapable();
  const device = useDevice();
  const useMobileView = isTouchDevice || device === 'mobile';

  const { setStageCount } = useKanbanLayout();
  const pageRef = useRef<HTMLDivElement>(null);

  const handleBack = useCallback(() => {
    const navState = (location.state as { fromRoute?: '/dashboard' | '/my-jobs'; fromTab?: 'active' | 'expired' | 'draft' } | null) ?? null;
    if (navState?.fromRoute) {
      const tabSuffix = navState.fromTab && navState.fromTab !== 'active' ? `?tab=${navState.fromTab}` : '';
      navigate(`${navState.fromRoute}${tabSuffix}`, { replace: true });
    } else if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [location.state, navigate]);

  const { handlers: pullHandlers, style: pullStyle } = usePullToDismiss({
    wrapperRef: pageRef,
    onDismiss: handleBack,
    enabled: useMobileView,
  });
  
  const { 
    job, 
    applications, 
    stageTotals,
    totalApplications,
    isLoadingMore,
    isLoading: dataLoading, 
    updateApplicationLocally, 
    updateJobLocally,
    refetch 
  } = useJobDetailsData(jobId);

  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  

  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  
  const [swipeViewerOpen, setSwipeViewerOpen] = useState(false);
  const [swipeInitialIndex, setSwipeInitialIndex] = useState(0);
  const [swipeStageApps, setSwipeStageApps] = useState<JobApplication[]>([]);
  
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const { stageSettings, orderedStages, isLoading: stagesLoading } = useJobStageSettings(jobId);
  
  const { data: jobCriteria } = useJobCriteria(jobId || null);
  const criteriaCount = jobCriteria?.length || 0;
  
  const employerProfileImageUrl = useMediaUrl(job?.employer_profile?.profile_image_url, 'profile-image');

  // Samma deterministiska förvärmning som /candidates och /my-candidates:
  // text → media (porträtt/video) → CV-sammanfattningar.
  // Vi förvärmer de första 120 raderna — resten värms när man scrollar/öppnar.
  // Utan taket skulle en annons med 1 000 sökande dra ner 1 000 porträtt direkt.
  const WARMUP_LIMIT = 120;
  const warmupRows = useMemo(
    () =>
      applications.slice(0, WARMUP_LIMIT).map((a) => ({
        id: a.id,
        application_id: a.id,
        applicant_id: a.applicant_id,
        job_id: jobId ?? null,
        cv_url: a.cv_url ?? null,
        profile_image_url: a.profile_image_url ?? null,
        video_url: a.video_url ?? null,
        is_profile_video: a.is_profile_video ?? null,
      })),
    [applications, jobId]
  );
  useCandidatePageWarmup(warmupRows);




  // Karta över vilka sökande som redan ligger i en kandidatlista. Ligger i
  // React Query så realtidshändelser på my_candidates kan invalidera den.
  const applicantIdsKey = useMemo(
    () => applications.map(a => a.applicant_id).sort().join(','),
    [applications]
  );
  const { data: myCandidatesMap = new Map<string, string>() } = useQuery({
    queryKey: ['job-my-candidates-map', jobId, applicantIdsKey],
    enabled: !!user && applications.length > 0,
    staleTime: 60 * 1000,
    gcTime: Infinity,
    queryFn: async () => {
      const ids = applicantIdsKey.split(',').filter(Boolean);
      const map = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase
          .from('my_candidates')
          .select('id, applicant_id')
          .eq('recruiter_id', user!.id)
          .in('applicant_id', ids.slice(i, i + 200));
        (data || []).forEach(mc => map.set(mc.applicant_id, mc.id));
      }
      return map;
    },
  });


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const activeStages = orderedStages.length > 0 ? orderedStages : [...DEFAULT_JOB_STAGE_KEYS];

  useEffect(() => {
    setStageCount(activeStages.length);
  }, [activeStages.length, setStageCount]);

  const collisionDetectionStrategy = useMemo(
    () => columnXCollisionDetection(activeStages),
    [activeStages]
  );

  const updateApplicationStatus = useCallback(async (applicationId: string, newStatus: string) => {
    updateApplicationLocally(applicationId, { status: newStatus as JobApplication['status'] });

    try {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId)
        .select('id')
        .maybeSingle();

      if (error) {
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
  }, [updateApplicationLocally, refetch]);

  const updateCandidateRating = useCallback(async (applicantId: string, newRating: number) => {
    if (!getIsOnline()) {
      toast('Offline', { description: 'Du måste vara online för att uppdatera betyg' });
      return;
    }
    if (!user) return;

    updateApplicationLocally(
      applications.find(a => a.applicant_id === applicantId)?.id || '',
      { rating: newRating }
    );
    if (selectedApplication?.applicant_id === applicantId) {
      setSelectedApplication(prev => prev ? { ...prev, rating: newRating } : null);
    }

    try {
      // Betyget är per kandidat och lever i candidate_ratings — samma källa som
      // Mina kandidater. Kandidaten behöver alltså inte ligga i en lista först.
      const { error } = await supabase
        .from('candidate_ratings')
        .upsert(
          { recruiter_id: user.id, applicant_id: applicantId, rating: newRating },
          { onConflict: 'recruiter_id,applicant_id' }
        );
      if (error) throw error;

      // Håll ev. listrader i synk så att kortet visar samma sak överallt.
      const myCandidateId = myCandidatesMap.get(applicantId);
      if (myCandidateId) {
        await supabase
          .from('my_candidates')
          .update({ rating: newRating })
          .eq('recruiter_id', user.id)
          .eq('applicant_id', applicantId);
      }
    } catch {
      toast.error('Fel', { description: 'Kunde inte uppdatera betyg' });
      refetch();
    }
  }, [user, myCandidatesMap, updateApplicationLocally, applications, selectedApplication?.applicant_id, refetch]);


  const markApplicationAsViewed = useCallback(async (applicationId: string) => {
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
  }, [updateApplicationLocally]);

  const applicationsByStatus = useMemo(() => {
    const result: Record<string, JobApplication[]> = {};
    activeStages.forEach(stage => { result[stage] = []; });
    result['rejected'] = [];
    
    applications.forEach(app => {
      if (result[app.status]) {
        result[app.status].push(app);
      } else {
        const firstStage = activeStages[0];
        if (firstStage) {
          result[firstStage].push(app);
        }
      }
    });
    return result;
  }, [applications, activeStages]);

  // Serverns totaler är nycklade på rå status. Kort med en status som inte
  // längre finns som steg visas i första kolumnen — då måste deras total
  // följa med dit, annars visar kolumnen färre än antalet kort.
  const normalizedStageTotals = useMemo(() => {
    if (!stageTotals) return null;
    const known = new Set([...activeStages, 'rejected']);
    const out: Record<string, number> = {};
    const firstStage = activeStages[0];
    Object.entries(stageTotals).forEach(([status, count]) => {
      const key = known.has(status) ? status : firstStage;
      if (!key) return;
      out[key] = (out[key] || 0) + count;
    });
    return out;
  }, [stageTotals, activeStages]);

  const allVisibleApplicationIds = useMemo(() => {
    return applications.map(app => app.id);
  }, [applications]);

  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedCandidateIds: selectedApplicationIds,
    toggleCandidateSelection: toggleApplicationSelection,
    exitSelectionMode,
    allVisibleSelected,
    toggleAllVisible,
  } = useSelectionMode(allVisibleApplicationIds);

  const bulkMoveToStage = useCallback(async (targetStage: string) => {
    const idsToMove = Array.from(selectedApplicationIds);
    const count = idsToMove.length;
    const targetLabel = stageSettings[targetStage]?.label || targetStage;
    const stageColor = stageSettings[targetStage]?.color || '#22c55e';
    
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
  }, [selectedApplicationIds, stageSettings, updateApplicationLocally, exitSelectionMode, refetch]);

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
    const stage = resolveStageForApplication(app);
    const stageApps = applicationsByStatus[stage] || [];

    if (isTouchDevice) {
      // Touch: continuous vertical scroll viewer
      const idx = stageApps.findIndex(a => a.id === app.id);
      setSwipeStageApps(stageApps);
      setSwipeInitialIndex(idx >= 0 ? idx : 0);
      setSwipeViewerOpen(true);
    } else {
      // Mouse: open profile dialog
      setSelectedApplication(app);
      setSelectedStage(stage);
      setDialogOpen(true);
    }

    // Mark as viewed
    if (!app.viewed_at) {
      markApplicationAsViewed(app.id);
    }
  }, [applicationsByStatus, resolveStageForApplication, markApplicationAsViewed, isTouchDevice]);

  const swipeApplicationsAsData = useMemo(() => {
    return swipeStageApps.map(app => mapToApplicationData(app, jobId || '', job?.title || ''));
  }, [swipeStageApps, jobId, job?.title]);

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

  // Förvärm grannarna i steget när en profil är öppen, så att pilarna
  // ("nästa kandidat") visar bild/video/CV direkt i stället för att ladda.
  const neighborWarmupRows = useMemo(() => {
    if (!selectedApplication || !currentNavigationStage) return [];
    const stageApps = applicationsByStatus[currentNavigationStage] || [];
    const idx = stageApps.findIndex(a => a.id === selectedApplication.id);
    if (idx < 0) return [];
    return stageApps.slice(Math.max(0, idx - 3), idx + 4).map((a) => ({
      id: a.id,
      application_id: a.id,
      applicant_id: a.applicant_id,
      job_id: jobId ?? null,
      cv_url: a.cv_url ?? null,
      profile_image_url: a.profile_image_url ?? null,
      video_url: a.video_url ?? null,
      is_profile_video: a.is_profile_video ?? null,
    }));
  }, [selectedApplication, currentNavigationStage, applicationsByStatus, jobId]);
  useCandidatePageWarmup(neighborWarmupRows);


  const getDisplayRating = useCallback((app: ApplicationData) => {
    return app.rating || 0;
  }, []);

  const handlePrefetchCandidate = useCallback((app: JobApplication) => {
    if (!user || !app.applicant_id) return;
    prefetchCandidateActivities(queryClient, app.applicant_id, user.id);
    prefetchCandidateNotes(app.applicant_id);
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
        throw new Error('Ingen rad uppdaterades');
      }
      toast.success(`Flyttad till "${stageLabel}"`);
    } catch {
      refetch();
      toast.error('Kunde inte flytta kandidaten');
    }
  }, [updateApplicationLocally, stageSettings, refetch]);

  const handleMoveCandidatesForStage = useCallback(async (stageKey: string, targetKey: string) => {
    // Uppdatera de inlästa korten direkt (känns omedelbart) …
    const apps = applicationsByStatus[stageKey] || [];
    apps.forEach(a => updateApplicationLocally(a.id, { status: targetKey as JobApplication['status'] }));

    // … men flytta ALLA i steget på servern. Vid stora annonser är bara en
    // del av ansökningarna inlästa; utan detta blev resten kvar med en status
    // vars kolumn strax raderas och de försvann tyst ur vyn.
    const { error } = await supabase
      .from('job_applications')
      .update({ status: targetKey })
      .eq('job_id', jobId)
      .eq('status', stageKey);
    if (error) {
      refetch();
      throw error;
    }
  }, [applicationsByStatus, updateApplicationLocally, refetch, jobId]);

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const resolveOverStatus = useCallback((overRawId?: string): string | null => {
    if (!overRawId) return null;
    if (activeStages.includes(overRawId)) return overRawId;
    const overApp = applications.find((a) => a.id === overRawId);
    if (overApp && activeStages.includes(overApp.status)) return overApp.status;
    return null;
  }, [activeStages, applications]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overRawId = event.over?.id as string | undefined;
    const status = resolveOverStatus(overRawId);
    setOverId(status);
  }, [resolveOverStatus]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
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
      updateApplicationStatus(applicationId, targetStatus);
      requestAnimationFrame(() => {
        setActiveId(null);
        setOverId(null);
      });
    } else {
      setActiveId(null);
      setOverId(null);
    }
  }, [resolveOverStatus, applications, updateApplicationStatus]);

  const activeApplication = activeId ? applications.find(a => a.id === activeId) : null;

  // Cache per-stage counts + stage order per job so the skeleton kan matcha
  // exakt hur många kort som faktiskt ligger i varje kolumn nästa gång sidan
  // öppnas — inga "spökkort" från en annan annons.
  useEffect(() => {
    if (dataLoading || stagesLoading || !jobId) return;
    try {
      const counts: Record<string, number> = {};
      activeStages.forEach(s => { counts[s] = (applicationsByStatus[s] || []).length; });
      const payload = {
        stages: activeStages,
        labels: Object.fromEntries(activeStages.map(s => [s, stageSettings[s]?.label || s])),
        counts,
      };
      localStorage.setItem(`parium:jobDetails:${jobId}:layout`, JSON.stringify(payload));
    } catch { /* noop */ }
  }, [jobId, dataLoading, stagesLoading, activeStages, applicationsByStatus, stageSettings]);

  if (dataLoading || stagesLoading) {
    return <JobDetailsSkeleton jobId={jobId} />;
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen animate-fade-in">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  return (
     <div
       ref={pageRef}
       {...pullHandlers}
       style={pullStyle}
       className="space-y-3 md:space-y-4 w-full px-2 md:px-0 py-3 md:py-4 pb-safe min-h-screen animate-fade-in md:max-w-[clamp(20rem,82vw,76rem)] md:mx-auto md:px-[clamp(0.75rem,2.5vw,2rem)]">

        <JobDetailsHeader
          jobId={jobId!}
          job={job}
          employerProfileImageUrl={employerProfileImageUrl}
          applicationsCount={totalApplications ?? applications.length}
          activeStagesLength={activeStages.length}
          isSelectionMode={isSelectionMode}
          canToggleStatus={!!user?.id && job.employer_id === user.id}
          onToggleSelectionMode={() => setIsSelectionMode(true)}
          onExitSelectionMode={exitSelectionMode}
          onUpdateJobLocally={updateJobLocally}
        />

        {/* Touch devices: tab-based candidate list. Desktop: kanban with drag-and-drop */}
        <SectionErrorBoundary fallbackLabel="Kandidatvy">
        {useMobileView ? (
          <MobileCandidateView
            jobId={jobId || ''}
            applications={applications}
            stageTotals={normalizedStageTotals}
            stages={activeStages}
            stageSettings={stageSettings}
            criteriaCount={criteriaCount}
            onOpenProfile={handleOpenProfile}
            onMoveToStage={handleMobileMove}
            onMarkAsViewed={markApplicationAsViewed}
            onOpenCriteriaDialog={() => setCriteriaDialogOpen(true)}
            isSelectionMode={isSelectionMode}
            selectedApplicationIds={selectedApplicationIds}
            onToggleSelect={toggleApplicationSelection}
            renderActionBar={isSelectionMode ? (
              <div className="animate-in slide-in-from-bottom-4 duration-300 flex justify-center mt-2">
                <SelectionActionBar
                  selectedCount={selectedApplicationIds.size}
                  totalCount={allVisibleApplicationIds.length}
                  allSelected={allVisibleSelected}
                  onToggleAll={toggleAllVisible}
                  disabled={selectedApplicationIds.size === 0}
                  stages={activeStages}
                  stageSettings={stageSettings}
                  onMoveToStage={bulkMoveToStage}
                />
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
            {/* Samma tavelstruktur som Mina kandidater: kolumnerna delar bredden
                jämnt utan horisontell scroll — inget hoppar under hover/drag. */}
            <div 
              className="flex gap-3 pb-4 pt-2 w-full"
              style={{ 
                height: 'calc(100vh - 300px)',
                overflowX: 'hidden',
                overflowY: 'hidden',
              }}
            >
              {activeStages.map((status, stageIndex) => {
                const config = stageSettings[status] || { label: status, color: '#0EA5E9', iconName: 'inbox', isCustom: false };
                const targetIdx = stageIndex < activeStages.length - 1 ? stageIndex + 1 : stageIndex - 1;
                const targetKey = targetIdx >= 0 ? activeStages[targetIdx] : undefined;
                const targetLabel = targetKey ? (stageSettings[targetKey]?.label || targetKey) : undefined;
                
                return (
                  <StatusColumn 
                    key={status}
                    jobId={jobId || ''}
                    status={status}
                    applications={applicationsByStatus[status] || []}
                    stageTotal={normalizedStageTotals ? normalizedStageTotals[status] ?? 0 : null}
                    isStreaming={isLoadingMore}
                    onOpenProfile={handleOpenProfile}
                    onMarkAsViewed={markApplicationAsViewed}
                    onPrefetch={handlePrefetchCandidate}
                    onOpenCriteriaDialog={stageIndex === 0 ? () => setCriteriaDialogOpen(true) : undefined}
                    stageConfig={config}
                    totalStageCount={activeStages.length}
                    stageIndex={stageIndex}
                    columnSlots={activeStages.length}
                    criteriaCount={criteriaCount}
                    isSelectionMode={isSelectionMode}
                    selectedApplicationIds={selectedApplicationIds}
                    onToggleSelect={toggleApplicationSelection}
                    targetStageKey={targetKey}
                    targetStageLabel={targetLabel}
                    onMoveCandidatesAndDelete={targetKey ? () => handleMoveCandidatesForStage(status, targetKey) : undefined}
                  />
                );
              })}
            </div>

            <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
              {activeApplication ? (
                <div className="opacity-95 pointer-events-none">
                  <ApplicationCardContent
                    application={activeApplication}
                    isDragging
                    criteriaCount={criteriaCount}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        </SectionErrorBoundary>

        {/* Candidate Profile Dialog */}
        <CandidateProfileDialog
          application={selectedApplication ? mapToApplicationData(selectedApplication, jobId || '', job?.title || 'Okänt jobb') : null}
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

        {/* Floating Action Bar for Selection Mode — desktop only */}
        {isSelectionMode && (
          <div className="hidden md:flex fixed bottom-6 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300 px-4 justify-center">
            <SelectionActionBar
              selectedCount={selectedApplicationIds.size}
              totalCount={allVisibleApplicationIds.length}
              allSelected={allVisibleSelected}
              onToggleAll={toggleAllVisible}
              disabled={selectedApplicationIds.size === 0}
              stages={activeStages}
              stageSettings={stageSettings}
              onMoveToStage={bulkMoveToStage}
            />
          </div>
        )}
      </div>
  );
};

export default JobDetails;
