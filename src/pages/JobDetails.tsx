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
import { CandidateProfileDialog } from '@/components/CandidateProfileDialog';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { SelectionCriteriaDialog } from '@/components/SelectionCriteriaDialog';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';
import { useJobStageSettings, DEFAULT_JOB_STAGE_KEYS } from '@/hooks/useJobStageSettings';
import { useJobDetailsData, type JobApplication } from '@/hooks/useJobDetailsData';
import { useJobCriteria } from '@/hooks/useCriteriaResults';
import { useKanbanLayout } from '@/hooks/useKanbanLayout';
import { 
  X,
  Users,
  Eye,
  MapPin,
  Plus,
  CheckSquare,
} from 'lucide-react';
import JobQrCodeButton from '@/components/JobQrCode';
import { TruncatedText } from '@/components/TruncatedText';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

// Extracted components
import { SelectionActionBar, ApplicationCardContent, StatusColumn, mapToApplicationData } from '@/components/jobdetails';

const JobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isTouchDevice = useTouchCapable();
  const device = useDevice();
  const useMobileView = isTouchDevice || device === 'mobile';
  
  const { setStageCount } = useKanbanLayout();
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  
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
  const myCandidatesApplicantIdsRef = useRef<string>('');
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  
  const [swipeViewerOpen, setSwipeViewerOpen] = useState(false);
  const [swipeInitialIndex, setSwipeInitialIndex] = useState(0);
  const [swipeStageApps, setSwipeStageApps] = useState<JobApplication[]>([]);
  
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  
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

  const { stageSettings, orderedStages, isLoading: stagesLoading } = useJobStageSettings(jobId);
  
  const { data: jobCriteria } = useJobCriteria(jobId || null);
  const criteriaCount = jobCriteria?.length || 0;
  
  const employerProfileImageUrl = useMediaUrl(job?.employer_profile?.profile_image_url, 'profile-image');

  // Load my_candidates map for rating updates — only re-fetch when applicant IDs actually change
  useEffect(() => {
    if (!user || applications.length === 0) return;
    
    const applicantIds = applications.map(a => a.applicant_id).sort();
    const idsHash = applicantIds.join(',');
    if (idsHash === myCandidatesApplicantIdsRef.current) return;
    myCandidatesApplicantIdsRef.current = idsHash;
    
    const loadMyCandidatesMap = async () => {
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

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
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
  };

  const updateCandidateRating = async (applicantId: string, newRating: number) => {
    if (!navigator.onLine) {
      toast('Offline', { description: 'Du måste vara online för att uppdatera betyg' });
      return;
    }

    const myCandidateId = myCandidatesMap.get(applicantId);
    if (!myCandidateId) {
      toast('Info', { description: 'Lägg först till kandidaten i din lista för att ge betyg' });
      return;
    }
    
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

  const allVisibleApplicationIds = useMemo(() => {
    return applications.map(app => app.id);
  }, [applications]);
  
  const allVisibleSelected = useMemo(() => {
    return (
      allVisibleApplicationIds.length > 0 &&
      allVisibleApplicationIds.every((id) => selectedApplicationIds.has(id))
    );
  }, [allVisibleApplicationIds, selectedApplicationIds]);

  const toggleAllVisible = useCallback(() => {
    setSelectedApplicationIds((prev) => {
      const allSelected =
        allVisibleApplicationIds.length > 0 &&
        allVisibleApplicationIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allVisibleApplicationIds);
    });
  }, [allVisibleApplicationIds]);

  const bulkMoveToStage = async (targetStage: string) => {
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
    const stage = resolveStageForApplication(app);
    const stageApps = applicationsByStatus[stage] || [];

    if (isTouchDevice) {
      const idx = stageApps.findIndex(a => a.id === app.id);
      setSwipeStageApps(stageApps);
      setSwipeInitialIndex(idx >= 0 ? idx : 0);
      setSwipeViewerOpen(true);
    } else {
      setSelectedApplication(app);
      setSelectedStage(stage);
      setDialogOpen(true);
    }
  }, [isTouchDevice, applicationsByStatus, resolveStageForApplication]);

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

  const getDisplayRating = useCallback((app: ApplicationData) => {
    return app.rating || 0;
  }, []);

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

  const resolveOverStatus = useCallback((overRawId?: string): string | null => {
    if (!overRawId) return null;
    if (activeStages.includes(overRawId)) return overRawId;
    const overApp = applications.find((a) => a.id === overRawId);
    if (overApp && activeStages.includes(overApp.status)) return overApp.status;
    return null;
  }, [activeStages, applications]);

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
      updateApplicationStatus(applicationId, targetStatus);
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

  // Show skeleton while loading
  if (dataLoading || stagesLoading) {
    return (
       <div className="space-y-4 responsive-container-wide py-4 pb-safe min-h-screen animate-fade-in">
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
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
            <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
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
          <div className="flex items-start justify-between gap-2">
            <TruncatedText 
              text={job.title} 
              className="text-lg font-bold text-white flex-1 min-w-0 line-clamp-2"
            />
            <button
              onClick={() => {
                if (window.history.length > 1) {
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

          <div className="mt-3 space-y-1.5 md:space-y-0">
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 min-w-0">
              <div className="bg-white/5 rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 min-w-0 overflow-hidden">
                <Eye className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-white text-xs font-medium truncate">{job.views_count}</span>
                <span className="text-white text-xs truncate">Visn.</span>
              </div>

              <div className="bg-white/5 rounded-lg px-2 py-1.5 flex items-center justify-center gap-1 min-w-0 overflow-hidden">
                <Users className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <span className="text-white text-xs font-medium truncate">{job.applications_count}</span>
                <span className="text-white text-xs truncate">Ans.</span>
              </div>

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
            city: selectedApplication.city,
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
