import { useMemo, useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { formatTimeAgo } from '@/lib/date';
import { CandidateProfileDialog } from './CandidateProfileDialog';
import { CandidateAvatar } from './CandidateAvatar';
import { useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTeamCandidateInfo } from '@/hooks/useTeamCandidateInfo';
import { AddToColleagueListDialog } from './AddToColleagueListDialog';
import { UserPlus, Clock, Star, Users, ArrowUpDown, ArrowUp, ArrowDown, MessageCircle, ChevronRight, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCvSummaryPreloader } from '@/hooks/useCvSummaryPreloader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { prefetchCandidateActivities } from '@/hooks/useCandidateActivities';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/use-device';
import { useTouchCapable } from '@/hooks/useInputCapability';
import { MobileCandidatesList } from '@/components/candidates/MobileCandidatesList';
import { BulkMessageDialog } from '@/components/candidates/BulkMessageDialog';
import { InfiniteScrollSentinel } from '@/components/candidates/InfiniteScrollSentinel';
import { CandidateSwipeViewer } from '@/components/candidates/CandidateSwipeViewer';
import { useBulkMessageSync } from '@/hooks/useBulkMessageSync';
import { useCandidateBatchPrefetch } from '@/hooks/useCandidateBatchPrefetch';
import {
  findExistingConversationId,
  createConversationForCandidate,
  ensureConversationMemberships,
  isRetryableError,
  formatConversationError,
} from '@/lib/conversationService';

type SortField = 'name' | 'rating' | 'applied_at' | 'last_active_at' | null;
type SortDirection = 'asc' | 'desc' | null;

interface CandidatesTableProps {
  applications: ApplicationData[];
  onUpdate: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  selectionMode?: boolean;
  onSelectionModeChange?: (mode: boolean) => void;
  hasReachedLimit?: boolean;
  onContinueLoading?: () => void;
  loadedCount?: number;
  onRatingUpdate?: (applicantId: string, rating: number) => void;
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export function CandidatesTable({ 
  applications, 
  onUpdate, 
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  selectionMode = false,
  onSelectionModeChange,
  hasReachedLimit = false,
  onContinueLoading,
  loadedCount = 0,
  onRatingUpdate,
}: CandidatesTableProps) {
  const deviceType = useDevice();
  const isMobile = deviceType === 'mobile';
  const isTouchDevice = useTouchCapable();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [swipeViewerOpen, setSwipeViewerOpen] = useState(false);
  const [swipeInitialIndex, setSwipeInitialIndex] = useState(0);
  const [allCandidateApplications, setAllCandidateApplications] = useState<ApplicationData[]>([]);
  const [loadingAllCandidateApplications, setLoadingAllCandidateApplications] = useState(false);
  const { isInMyCandidates, addCandidate, addCandidates, isLoading: isMyCandidatesLoading, isMyCandidatesSettling } = useMyCandidatesData();
  const { teamMembers, hasTeam } = useTeamMembers();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // ── Extracted hooks ──────────────────────────────────
  useBulkMessageSync();
  const { readCache, fetchForApplicant, writeCache, prefetchSingle } = useCandidateBatchPrefetch(applications);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedApplications = useMemo(
    () => applications.filter((a) => selectedIds.has(a.id)),
    [applications, selectedIds]
  );
  const selectedRecipientApplications = useMemo(
    () =>
      Array.from(
        new Map(
          selectedApplications
            .filter((app) => Boolean(app.applicant_id) && app.applicant_id !== user?.id)
            .map((app) => [app.applicant_id, app])
        ).values()
      ),
    [selectedApplications, user?.id]
  );
  const selectedRecipientCount = selectedRecipientApplications.length;
  const allSelected = applications.length > 0 && selectedIds.size === applications.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < applications.length;

  // Sorting state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Clear selection when selection mode is turned off
  useEffect(() => {
    if (!selectionMode) setSelectedIds(new Set());
  }, [selectionMode]);

  // Team candidate info
  const applicationIds = useMemo(() => applications.map(a => a.id), [applications]);
  const { teamCandidates } = useTeamCandidateInfo(applicationIds);
  
  // Team selection dialog state
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedApplicationForTeam, setSelectedApplicationForTeam] = useState<ApplicationData | null>(null);

  // Preload CV summaries
  useCvSummaryPreloader(
    applications.map(app => ({
      applicant_id: app.applicant_id,
      application_id: app.id,
      job_id: app.job_id,
      cv_url: app.cv_url,
    }))
  );

  // Prefetch candidate data on hover
  const handlePrefetchCandidate = useCallback((application: ApplicationData) => {
    if (!user || !application.applicant_id) return;

    prefetchCandidateActivities(queryClient, application.applicant_id, user.id);

    queryClient.prefetchQuery({
      queryKey: ['candidate-notes', application.applicant_id],
      queryFn: async () => {
        const { data } = await supabase
          .from('candidate_notes')
          .select('*')
          .eq('applicant_id', application.applicant_id)
          .is('job_id', null);
        return data || [];
      },
      staleTime: Infinity,
    });

    prefetchSingle(application);
  }, [user, queryClient, prefetchSingle]);

  const selectedApplication = useMemo(() => {
    if (!selectedApplicationId) return null;
    return applications.find((a) => a.id === selectedApplicationId) || null;
  }, [applications, selectedApplicationId]);

  // Fetch all applications from the same applicant
  useEffect(() => {
    const fetchAllApplications = async () => {
      if (!selectedApplication || !user || !dialogOpen) {
        setAllCandidateApplications([]);
        setLoadingAllCandidateApplications(false);
        return;
      }

      setLoadingAllCandidateApplications(true);

      const cachedApplications = readCache(selectedApplication.applicant_id);
      if (cachedApplications?.length) {
        const hasSelected = cachedApplications.some((app) => app.id === selectedApplication.id);
        setAllCandidateApplications(
          hasSelected
            ? cachedApplications
            : [selectedApplication, ...cachedApplications.filter((app) => app.id !== selectedApplication.id)]
        );
      } else {
        setAllCandidateApplications([selectedApplication]);
      }

      try {
        const freshApplications = await fetchForApplicant(selectedApplication);
        setAllCandidateApplications(freshApplications);
        writeCache(selectedApplication.applicant_id, freshApplications);
      } catch (error) {
        console.error('Error fetching candidate applications:', error);
        if (!cachedApplications?.length) {
          setAllCandidateApplications([selectedApplication]);
        }
      } finally {
        setLoadingAllCandidateApplications(false);
      }
    };

    fetchAllApplications();
  }, [selectedApplication?.applicant_id, selectedApplication?.id, user?.id, dialogOpen, fetchForApplicant, readCache, writeCache]);

  const handleRowClick = useCallback((application: ApplicationData) => {
    // On touch devices: open TikTok-style swipe viewer
    if (isTouchDevice) {
      const idx = applications.findIndex(a => a.id === application.id);
      setSwipeInitialIndex(idx >= 0 ? idx : 0);
      setSwipeViewerOpen(true);
      return;
    }
    // Desktop: open dialog as before
    const cachedApplications = readCache(application.applicant_id);
    setAllCandidateApplications(cachedApplications?.length ? cachedApplications : [application]);
    setSelectedApplicationId(application.id);
    setDialogOpen(true);
  }, [isTouchDevice, applications, readCache]);

  // Handle opening full profile from swipe viewer
  const handleSwipeOpenFullProfile = useCallback((application: ApplicationData) => {
    setSwipeViewerOpen(false);
    const cachedApplications = readCache(application.applicant_id);
    setAllCandidateApplications(cachedApplications?.length ? cachedApplications : [application]);
    setSelectedApplicationId(application.id);
    setDialogOpen(true);
  }, [readCache]);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setTimeout(() => setSelectedApplicationId(null), 300);
  }, []);

  // --- Bulk selection handlers ---
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map(a => a.id)));
    }
  }, [allSelected, applications]);

  const toggleSelect = useCallback((id: string, checked?: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (typeof checked === 'boolean') {
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionModeChange?.(false);
  }, [onSelectionModeChange]);

  const handleBulkAddToMyCandidates = useCallback(async () => {
    const selectedApps = selectedApplications;
    if (selectedApps.length === 0) return;

    const candidatesToAdd = selectedApps.map(app => ({
      applicationId: app.id,
      applicantId: app.applicant_id,
      jobId: app.job_id,
    }));

    await addCandidates.mutateAsync(candidatesToAdd);
    setSelectedIds(new Set());
    onSelectionModeChange?.(false);
    onUpdate();
  }, [selectedApplications, addCandidates, onSelectionModeChange, onUpdate]);

  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const handleBulkSendMessage = useCallback(async (content: string) => {
    if (!user) return;

    if (selectedRecipientApplications.length === 0) {
      toast.error('Inga giltiga kandidater valda');
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error('Meddelandet är tomt');
      return;
    }

    // --- Offline queue: save for later sync instead of failing ---
    if (!navigator.onLine) {
      const BULK_QUEUE_KEY = 'parium_bulk_message_queue';
      try {
        const existing = JSON.parse(localStorage.getItem(BULK_QUEUE_KEY) || '[]');
        const newItems = selectedRecipientApplications.map(app => ({
          id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          sender_id: user.id,
          applicant_id: app.applicant_id,
          job_id: app.job_id,
          application_id: app.id,
          content: trimmedContent,
          created_at: new Date().toISOString(),
          attempts: 0,
        }));
        localStorage.setItem(BULK_QUEUE_KEY, JSON.stringify([...existing, ...newItems]));
        toast.success(`${newItems.length} meddelande${newItems.length !== 1 ? 'n' : ''} köade – skickas automatiskt när du är online igen`);
        setSelectedIds(new Set());
        onSelectionModeChange?.(false);
        setBulkMessageOpen(false);
        return;
      } catch {
        toast.error('Kunde inte spara meddelanden offline');
        return;
      }
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const recipients = selectedRecipientApplications;

    if (recipients.length === 0) {
      toast.error('Inga giltiga kandidater valda');
      return;
    }

    const sendToCandidate = async (app: ApplicationData, attempt = 1): Promise<void> => {
      try {
        let conversationId = await findExistingConversationId(user.id, app.applicant_id);

        if (!conversationId) {
          conversationId = await createConversationForCandidate(user.id, app.applicant_id, app.job_id, app.id);
        }

        await ensureConversationMemberships(conversationId, user.id, app.applicant_id);

        const { error: msgError } = await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: trimmedContent,
          });

        if (msgError) throw msgError;
      } catch (error) {
        if (attempt === 1 && isRetryableError(error)) {
          await sleep(180);
          return sendToCandidate(app, 2);
        }
        throw error;
      }
    };

    let successCount = 0;
    const failureReasons: string[] = [];

    // --- Progress tracking ---
    setBulkProgress({ current: 0, total: recipients.length });

    for (const app of recipients) {
      try {
        await sendToCandidate(app);
        successCount++;
      } catch (error: any) {
        const reason = formatConversationError(error);
        failureReasons.push(reason);
        console.error(`Failed to send message to ${app.applicant_id}:`, error);
      }
      setBulkProgress({ current: successCount + failureReasons.length, total: recipients.length });
    }

    setBulkProgress(null);

    if (successCount > 0) {
      toast.success(`Meddelande skickat till ${successCount} kandidat${successCount !== 1 ? 'er' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }

    const failedCount = recipients.length - successCount;
    if (failedCount > 0) {
      const uniqueReasons = Array.from(new Set(failureReasons));
      toast.error(
        `Kunde inte skicka till ${failedCount} kandidat${failedCount !== 1 ? 'er' : ''}`,
        {
          description: uniqueReasons[0] || undefined,
        }
      );
    }

    // Behåll val/dialog öppna vid total-fel så användaren kan försöka igen direkt
    if (successCount > 0) {
      setSelectedIds(new Set());
      onSelectionModeChange?.(false);
      setBulkMessageOpen(false);
    }
  }, [selectedRecipientApplications, user, onSelectionModeChange, queryClient]);

  // --- Sorting ---
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else if (sortDirection === 'asc') { setSortField(null); setSortDirection(null); }
      else setSortDirection('desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField, sortDirection]);

  // --- Team info helpers ---
  const getTeamInfo = useCallback((appId: string) => {
    const info = teamCandidates[appId];
    if (!info || info.length === 0) return null;
    
    const avgRating = info.reduce((sum, c) => sum + c.rating, 0) / info.length;
    const colleagues = info.filter(c => c.recruiter_name !== 'Du');
    
    return {
      avgRating: Math.round(avgRating * 10) / 10,
      maxRating: Math.max(...info.map(c => c.rating)),
      colleagues: colleagues.map(c => c.recruiter_name),
      count: info.length,
    };
  }, [teamCandidates]);

  const getDisplayRating = useCallback((application: ApplicationData) => {
    if (application.rating !== undefined && application.rating !== null) return application.rating;
    const teamInfo = getTeamInfo(application.id);
    return teamInfo?.maxRating || 0;
  }, [getTeamInfo]);

  // Sort applications
  const sortedApplications = useMemo(() => {
    if (!sortField || !sortDirection) return applications;

    return [...applications].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name': {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
          comparison = nameA.localeCompare(nameB, 'sv');
          break;
        }
        case 'rating':
          comparison = getDisplayRating(a) - getDisplayRating(b);
          break;
        case 'applied_at':
          comparison = (a.applied_at ? new Date(a.applied_at).getTime() : 0) - (b.applied_at ? new Date(b.applied_at).getTime() : 0);
          break;
        case 'last_active_at':
          comparison = (a.last_active_at ? new Date(a.last_active_at).getTime() : 0) - (b.last_active_at ? new Date(b.last_active_at).getTime() : 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [applications, sortField, sortDirection, getDisplayRating]);

  // Navigate to prev/next candidate in the sorted list (lightbox-style arrows)
  const handleNavigatePrev = useMemo(() => {
    if (!selectedApplicationId) return undefined;
    const idx = sortedApplications.findIndex(a => a.id === selectedApplicationId);
    if (idx <= 0) return undefined;
    return () => {
      const prevApp = sortedApplications[idx - 1];
      const cached = readCache(prevApp.applicant_id);
      setAllCandidateApplications(cached?.length ? cached : [prevApp]);
      setSelectedApplicationId(prevApp.id);
    };
  }, [selectedApplicationId, sortedApplications, readCache]);

  const handleNavigateNext = useMemo(() => {
    if (!selectedApplicationId) return undefined;
    const idx = sortedApplications.findIndex(a => a.id === selectedApplicationId);
    if (idx < 0 || idx >= sortedApplications.length - 1) return undefined;
    return () => {
      const nextApp = sortedApplications[idx + 1];
      const cached = readCache(nextApp.applicant_id);
      setAllCandidateApplications(cached?.length ? cached : [nextApp]);
      setSelectedApplicationId(nextApp.id);
    };
  }, [selectedApplicationId, sortedApplications, readCache]);

  const SortIcon = ({ field }: { field: SortField }) => {
    const base = "h-3.5 w-3.5 ml-1.5 shrink-0 text-white";
    if (sortField !== field || sortDirection === null) return <ArrowUpDown className={base} />;
    return sortDirection === 'asc' ? <ArrowUp className={base} /> : <ArrowDown className={base} />;
  };

  // --- Mobile handlers (stable callbacks for memoized cards) ---
  const handleMobileToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleMobileAddCandidate = useCallback((app: ApplicationData) => {
    addCandidate.mutate({
      applicationId: app.id,
      applicantId: app.applicant_id,
      jobId: app.job_id,
    });
  }, [addCandidate]);

  const handleMobileAddToTeam = useCallback((app: ApplicationData) => {
    setSelectedApplicationForTeam(app);
    setTeamDialogOpen(true);
  }, []);

  // --- Empty state ---
  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="bg-white/5 rounded-full p-6 mb-4">
          <svg className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Inga kandidater än</h3>
        <p className="text-sm text-white max-w-sm">
          När någon söker till dina jobbannonser kommer deras ansökningar att visas här.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk actions bar */}
      {selectionMode && (
        <div className="animate-in slide-in-from-bottom-4 duration-300 flex justify-center mb-3">
          <div className="flex items-center gap-2.5 bg-card-parium/95 backdrop-blur-md border border-white/20 rounded-full px-5 py-3 shadow-xl overflow-hidden min-w-0 max-w-full">
            <span className="text-white text-sm font-semibold whitespace-nowrap flex-shrink-0">
              {selectedIds.size > 0 
                ? `${selectedIds.size} markerad${selectedIds.size !== 1 ? 'e' : ''}`
                : 'Välj kandidater'
              }
            </span>
            {selectedIds.size > 0 && (
              <>
                <div className="w-px h-6 bg-white/20 flex-shrink-0" />
                <button
                  className="flex items-center justify-center px-3 h-11 text-sm font-medium whitespace-nowrap flex-shrink-0 text-white outline-none focus:outline-none transition-all duration-200 rounded-md active:scale-[0.97] touch-manipulation"
                  onClick={() => setSelectedIds(new Set())}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Avmarkera
                </button>
                <div className="w-px h-6 bg-white/20 flex-shrink-0" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center px-3 h-11 text-sm font-medium whitespace-nowrap flex-shrink-0 text-white outline-none focus:outline-none transition-all duration-200 rounded-md active:scale-[0.97] touch-manipulation"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      Åtgärder
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="border-white/20 min-w-[180px]">
                    <DropdownMenuItem 
                      className="text-white hover:text-white cursor-pointer"
                      onClick={handleBulkAddToMyCandidates}
                      disabled={addCandidates.isPending}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {addCandidates.isPending ? 'Lägger till...' : 'Lägg till i Mina kandidater'}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-white hover:text-white cursor-pointer"
                      onClick={() => {
                        if (selectedRecipientCount === 0) {
                          toast.error('Inga giltiga kandidater valda');
                          return;
                        }
                        setBulkMessageOpen(true);
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Skicka meddelande
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <div className="w-px h-6 bg-white/20 flex-shrink-0" />
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full text-white outline-none focus:outline-none transition-all duration-200 active:scale-[0.97] touch-manipulation"
              onClick={clearSelection}
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile card view */}
      {isMobile ? (
        <MobileCandidatesList
          applications={sortedApplications}
          selectedIds={selectedIds}
          selectionMode={selectionMode}
          isMyCandidatesLoading={isMyCandidatesLoading || isMyCandidatesSettling}
          hasTeam={hasTeam}
          getDisplayRating={getDisplayRating}
          getTeamInfo={getTeamInfo}
          isInMyCandidates={isInMyCandidates}
          onToggleSelect={handleMobileToggleSelect}
          onRowClick={handleRowClick}
          onAddCandidate={handleMobileAddCandidate}
          onAddToTeam={handleMobileAddToTeam}
        />
      ) : (
        /* Desktop table view */
        <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden" style={{ contain: 'layout style' }}>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                {selectionMode && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) (el as any).indeterminate = someSelected;
                      }}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="text-white cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('name')}>
                  <span className="flex items-center">Kandidat<SortIcon field="name" /></span>
                </TableHead>
                <TableHead className="text-white cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('rating')}>
                  <span className="flex items-center">Betyg<SortIcon field="rating" /></span>
                </TableHead>
                <TableHead className="text-white">Tjänst</TableHead>
                <TableHead className="text-white cursor-pointer hover:bg-white/5 select-none" onClick={() => handleSort('applied_at')}>
                  <span className="flex items-center">Ansökt<SortIcon field="applied_at" /></span>
                </TableHead>
                <TableHead className="text-white cursor-pointer hover:bg-white/5 select-none whitespace-nowrap" onClick={() => handleSort('last_active_at')}>
                  <span className="flex items-center">Senaste aktivitet<SortIcon field="last_active_at" /></span>
                </TableHead>
                <TableHead className="text-white w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApplications.map((application) => {
                const isAlreadyAdded = isInMyCandidates(application.id);
                const teamInfo = getTeamInfo(application.id);
                const isSelected = selectedIds.has(application.id);
                
                return (
                  <TableRow
                    key={application.id}
                    className={cn(
                      "group border-white/10 cursor-pointer transition-[background-color] duration-150",
                      !selectionMode && "hover:bg-white/5 active:scale-[0.98]",
                      isSelected && "bg-white/10"
                    )}
                    style={{ contain: 'layout style paint' }}
                    onClick={() => handleRowClick(application)}
                    onMouseEnter={() => handlePrefetchCandidate(application)}
                    onTouchStart={() => handlePrefetchCandidate(application)}
                  >
                    {selectionMode && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleSelect(application.id, checked === true)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CandidateAvatar
                          profileImageUrl={application.profile_image_url}
                          videoUrl={application.video_url}
                          isProfileVideo={application.is_profile_video}
                          firstName={application.first_name}
                          lastName={application.last_name}
                          stopPropagation
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{application.first_name} {application.last_name}</span>
                            {teamInfo && teamInfo.colleagues.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                                    <Users className="h-3 w-3 text-purple-300" />
                                    <span className="text-[10px] text-purple-300 font-medium">{teamInfo.colleagues.length}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs">Tillagd av: {teamInfo.colleagues.join(', ')}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {application.phone && <div className="text-sm text-muted-foreground">{application.phone}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const rating = getDisplayRating(application);
                          return (
                            <Star key={star} className={cn("h-3.5 w-3.5", star <= rating ? "fill-yellow-400 text-yellow-400" : "text-white/20")} />
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{application.job_title || 'Okänd tjänst'}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatTimeAgo(application.applied_at)}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {application.last_active_at ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          {formatTimeAgo(application.last_active_at)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {!isMyCandidatesLoading && !isMyCandidatesSettling && !isAlreadyAdded && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
                              disabled={addCandidate.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasTeam) {
                                  setSelectedApplicationForTeam(application);
                                  setTeamDialogOpen(true);
                                } else {
                                  addCandidate.mutate({
                                    applicationId: application.id,
                                    applicantId: application.applicant_id,
                                    jobId: application.job_id,
                                  });
                                }
                              }}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{hasTeam ? 'Lägg till i kandidatlista' : 'Lägg till i Mina kandidater'}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Infinite scroll sentinel */}
      {hasMore && !hasReachedLimit && (
        <InfiniteScrollSentinel onIntersect={onLoadMore} isLoading={isLoadingMore} />
      )}

      {/* "Vill du fortsätta?" banner */}
      {hasReachedLimit && hasMore && (
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-gradient-to-b from-background/50 to-background border-t border-border/50">
          <div className="text-center space-y-3 max-w-md">
            <p className="text-muted-foreground text-sm">
              Du har laddat <span className="font-semibold text-foreground">{loadedCount}+</span> kandidater
            </p>
            <p className="text-muted-foreground/80 text-xs">
              Vill du ladda fler? Du kan också använda sökfältet för att hitta specifika kandidater snabbare.
            </p>
            <Button variant="outline" onClick={onContinueLoading} className="mt-2">
              Ladda fler kandidater
            </Button>
          </div>
        </div>
      )}

      <CandidateProfileDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => { onUpdate(); handleDialogClose(); }}
        allApplications={allCandidateApplications.length > 0 ? allCandidateApplications : undefined}
        loadingApplications={loadingAllCandidateApplications}
        variant="all-candidates"
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        candidateIndex={selectedApplicationId ? sortedApplications.findIndex(a => a.id === selectedApplicationId) : undefined}
        candidateTotal={sortedApplications.length}
        candidateRating={selectedApplication ? getDisplayRating(selectedApplication) : undefined}
        onRatingChange={onRatingUpdate && selectedApplication ? (rating) => onRatingUpdate(selectedApplication.applicant_id, rating) : undefined}
      />

      {isTouchDevice && (
        <CandidateSwipeViewer
          applications={sortedApplications}
          initialIndex={swipeInitialIndex}
          open={swipeViewerOpen}
          onClose={() => setSwipeViewerOpen(false)}
          onOpenFullProfile={handleSwipeOpenFullProfile}
          getDisplayRating={getDisplayRating}
        />
      )}

      {selectedApplicationForTeam && (
        <AddToColleagueListDialog
          open={teamDialogOpen}
          onOpenChange={(open) => { setTeamDialogOpen(open); if (!open) setSelectedApplicationForTeam(null); }}
          teamMembers={teamMembers}
          applicationId={selectedApplicationForTeam.id}
          applicantId={selectedApplicationForTeam.applicant_id}
          jobId={selectedApplicationForTeam.job_id}
          candidateName={`${selectedApplicationForTeam.first_name || ''} ${selectedApplicationForTeam.last_name || ''}`.trim() || 'Kandidat'}
        />
      )}

      {bulkMessageOpen && (
        <BulkMessageDialog
          open={bulkMessageOpen}
          onOpenChange={setBulkMessageOpen}
          count={selectedRecipientCount}
          onSend={handleBulkSendMessage}
          progress={bulkProgress}
        />
      )}
    </>
  );
}
