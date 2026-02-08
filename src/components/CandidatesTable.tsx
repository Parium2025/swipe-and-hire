import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ApplicationData } from '@/hooks/useApplicationsData';
import { formatTimeAgo } from '@/lib/date';
import { CandidateProfileDialog } from './CandidateProfileDialog';
import { CandidateAvatar } from './CandidateAvatar';
import { useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTeamCandidateInfo } from '@/hooks/useTeamCandidateInfo';
import { AddToColleagueListDialog } from './AddToColleagueListDialog';
import { UserPlus, Clock, Loader2, Star, Users, Trash2, MoreHorizontal, CheckSquare, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

type SortField = 'name' | 'rating' | 'applied_at' | 'last_active_at' | null;
type SortDirection = 'asc' | 'desc' | null;

// Infinite scroll sentinel component
function InfiniteScrollSentinel({ 
  onIntersect, 
  isLoading 
}: { 
  onIntersect?: () => void; 
  isLoading?: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onIntersect) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          onIntersect();
        }
      },
      { rootMargin: '200px' } // Load early before reaching bottom
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [onIntersect, isLoading]);

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar fler kandidater...</span>
        </div>
      )}
    </div>
  );
}

interface CandidatesTableProps {
  applications: ApplicationData[];
  onUpdate: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  selectionMode?: boolean;
  onSelectionModeChange?: (mode: boolean) => void;
  // Nya props för "Vill du fortsätta?" banner
  hasReachedLimit?: boolean;
  onContinueLoading?: () => void;
  loadedCount?: number;
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
}: CandidatesTableProps) {
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isInMyCandidates, addCandidate, addCandidates, isLoading: isMyCandidatesLoading } = useMyCandidatesData();
  const { teamMembers, hasTeam } = useTeamMembers();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = applications.length > 0 && selectedIds.size === applications.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < applications.length;

  // Sorting state - 3-step toggle: null (neutral) → desc → asc → null
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Clear selection when selection mode is turned off
  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // Team candidate info for colleague indicators
  const applicationIds = useMemo(() => applications.map(a => a.id), [applications]);
  const { teamCandidates } = useTeamCandidateInfo(applicationIds);
  
  // State for team selection dialog
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedApplicationForTeam, setSelectedApplicationForTeam] = useState<ApplicationData | null>(null);

  // Förladda CV-sammanfattningar i bakgrunden
  useCvSummaryPreloader(
    applications.map(app => ({
      applicant_id: app.applicant_id,
      application_id: app.id,
      job_id: app.job_id,
      cv_url: app.cv_url,
    }))
  );

  // Prefetch candidate data on hover for instant profile opening
  const handlePrefetchCandidate = useCallback((application: ApplicationData) => {
    if (!user || !application.applicant_id) return;
    
    // Prefetch activities
    prefetchCandidateActivities(queryClient, application.applicant_id, user.id);
    
    // Prefetch persistent notes
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
  }, [user, queryClient]);

  // Derive selected application from latest list so refetch updates the dialog content
  const selectedApplication = useMemo(() => {
    if (!selectedApplicationId) return null;
    return applications.find((a) => a.id === selectedApplicationId) || null;
  }, [applications, selectedApplicationId]);

  const handleRowClick = (application: ApplicationData) => {
    setSelectedApplicationId(application.id);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => setSelectedApplicationId(null), 300);
  };

  // Bulk selection handlers
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map(a => a.id)));
    }
  }, [allSelected, applications]);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    onSelectionModeChange?.(false);
  }, [onSelectionModeChange]);

  // Handle bulk add to my candidates
  const handleBulkAddToMyCandidates = useCallback(async () => {
    const selectedApps = applications.filter(a => selectedIds.has(a.id));
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
  }, [applications, selectedIds, addCandidates, onSelectionModeChange, onUpdate]);

  // Sorting logic - 3-step toggle: neutral → desc → asc → neutral
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField, sortDirection]);

  // Get average rating for an application from team candidates (for colleagues)
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

  // Get display rating - prefer direct application rating, fallback to team info
  const getDisplayRating = useCallback((application: ApplicationData) => {
    // Direct rating from batch fetch (instant)
    if (application.rating !== undefined && application.rating !== null) {
      return application.rating;
    }
    // Fallback to team info (for colleague ratings)
    const teamInfo = getTeamInfo(application.id);
    return teamInfo?.maxRating || 0;
  }, [getTeamInfo]);

  // Sort applications
  const sortedApplications = useMemo(() => {
    // No sorting when neutral (sortField or sortDirection is null)
    if (!sortField || !sortDirection) return applications;

    return [...applications].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
          comparison = nameA.localeCompare(nameB, 'sv');
          break;
        case 'rating':
          const ratingA = getDisplayRating(a);
          const ratingB = getDisplayRating(b);
          comparison = ratingA - ratingB;
          break;
        case 'applied_at':
          const dateA = a.applied_at ? new Date(a.applied_at).getTime() : 0;
          const dateB = b.applied_at ? new Date(b.applied_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'last_active_at':
          const activeA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
          const activeB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
          comparison = activeA - activeB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [applications, sortField, sortDirection, getDisplayRating]);

  // Sort icon helper - shows both arrows when neutral
  const SortIcon = ({ field }: { field: SortField }) => {
    // Always white, regardless of state
    const base = "h-3.5 w-3.5 ml-1.5 shrink-0 text-white";

    // Neutral state (no sorting or different field): show both arrows
    if (sortField !== field || sortDirection === null) {
      return <ArrowUpDown className={base} />;
    }
    
    // Active sorting: show single arrow
    return sortDirection === 'asc'
      ? <ArrowUp className={base} />
      : <ArrowDown className={base} />;
  };

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="bg-white/5 rounded-full p-6 mb-4">
          <svg
            className="h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
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
      {/* Bulk actions bar - only visible when in selection mode */}
      {selectionMode && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-between">
          <span className="text-xs text-white">
            {selectedIds.size > 0 
              ? `${selectedIds.size} markerad${selectedIds.size !== 1 ? 'e' : ''}`
              : 'Välj kandidater'
            }
          </span>
          <div className="flex items-center gap-1.5">
            {selectedIds.size > 0 && (
              <>
                <button
                  className="h-7 px-2.5 rounded-lg text-white hover:bg-white/10 border border-white/10 text-xs transition-colors"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Avmarkera
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-7 px-2.5 rounded-lg text-white hover:bg-white/10 border border-white/10 text-xs transition-colors"
                    >
                      Åtgärder
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[hsl(222,47%,11%)] border-white/10 min-w-[180px]">
                    <DropdownMenuItem 
                      className="text-white cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white"
                      onClick={handleBulkAddToMyCandidates}
                      disabled={addCandidates.isPending}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {addCandidates.isPending ? 'Lägger till...' : 'Lägg till i Mina kandidater'}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-400 cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-red-400">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Ta bort
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
              onClick={clearSelection}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden" style={{ contain: 'layout style' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              {selectionMode && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        (el as any).indeterminate = someSelected;
                      }
                    }}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead 
                className="text-white cursor-pointer hover:bg-white/5 select-none"
                onClick={() => handleSort('name')}
              >
                <span className="flex items-center">
                  Kandidat
                  <SortIcon field="name" />
                </span>
              </TableHead>
              <TableHead 
                className="text-white cursor-pointer hover:bg-white/5 select-none"
                onClick={() => handleSort('rating')}
              >
                <span className="flex items-center">
                  Betyg
                  <SortIcon field="rating" />
                </span>
              </TableHead>
              <TableHead className="text-white">Tjänst</TableHead>
              <TableHead 
                className="text-white cursor-pointer hover:bg-white/5 select-none"
                onClick={() => handleSort('applied_at')}
              >
                <span className="flex items-center">
                  Ansökt
                  <SortIcon field="applied_at" />
                </span>
              </TableHead>
              <TableHead 
                className="text-white cursor-pointer hover:bg-white/5 select-none whitespace-nowrap"
                onClick={() => handleSort('last_active_at')}
              >
                <span className="flex items-center">
                  Senaste aktivitet
                  <SortIcon field="last_active_at" />
                </span>
              </TableHead>
              <TableHead className="text-white w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedApplications.map((application) => {
              const status = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending;
              const isAlreadyAdded = isInMyCandidates(application.id);
              const teamInfo = getTeamInfo(application.id);
              const isSelected = selectedIds.has(application.id);
              
              return (
                <TableRow
                  key={application.id}
                  className={cn(
                    "group border-white/10 cursor-pointer transition-[background-color] duration-150",
                    !selectionMode && "hover:bg-white/5 active:bg-white/10",
                    isSelected && "bg-white/10"
                  )}
                  style={{ contain: 'layout style paint' }}
                  onClick={() => handleRowClick(application)}
                  onMouseEnter={() => handlePrefetchCandidate(application)}
                >
                  {selectionMode && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleSelect(application.id, e)}
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
                          <span className="font-medium text-white">
                            {application.first_name} {application.last_name}
                          </span>
                          {/* Colleague indicator */}
                          {teamInfo && teamInfo.colleagues.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                                  <Users className="h-3 w-3 text-purple-300" />
                                  <span className="text-[10px] text-purple-300 font-medium">
                                    {teamInfo.colleagues.length}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">
                                  Tillagd av: {teamInfo.colleagues.join(', ')}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {application.phone && (
                          <div className="text-sm text-muted-foreground">{application.phone}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const rating = getDisplayRating(application);
                        return (
                          <Star
                            key={star}
                            className={cn(
                              "h-3.5 w-3.5",
                              star <= rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-white/20"
                            )}
                          />
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {application.job_title || 'Okänd tjänst'}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(application.applied_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {application.last_active_at ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        {formatTimeAgo(application.last_active_at)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Dölj knappen under laddning för att undvika flicker */}
                    {!isMyCandidatesLoading && !isAlreadyAdded && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10"
                            disabled={addCandidate.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              // If user has team members, show selection dialog
                              if (hasTeam) {
                                setSelectedApplicationForTeam(application);
                                setTeamDialogOpen(true);
                              } else {
                                // No team, add directly to own list
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
                        <TooltipContent>
                          {hasTeam ? 'Lägg till i kandidatlista' : 'Lägg till i Mina kandidater'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* Infinite scroll sentinel - endast om vi inte nått gränsen */}
      {hasMore && !hasReachedLimit && (
        <InfiniteScrollSentinel 
          onIntersect={onLoadMore} 
          isLoading={isLoadingMore} 
        />
      )}

      {/* "Vill du fortsätta?" banner efter 500 kandidater */}
      {hasReachedLimit && hasMore && (
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-gradient-to-b from-background/50 to-background border-t border-border/50">
          <div className="text-center space-y-3 max-w-md">
            <p className="text-muted-foreground text-sm">
              Du har laddat <span className="font-semibold text-foreground">{loadedCount}+</span> kandidater
            </p>
            <p className="text-muted-foreground/80 text-xs">
              Vill du ladda fler? Du kan också använda sökfältet för att hitta specifika kandidater snabbare.
            </p>
            <Button
              variant="outline"
              onClick={onContinueLoading}
              className="mt-2"
            >
              Ladda fler kandidater
            </Button>
          </div>
        </div>
      )}

      <CandidateProfileDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => {
          onUpdate();
          handleDialogClose();
        }}
        variant="all-candidates"
      />

      {/* Team selection dialog */}
      {selectedApplicationForTeam && (
        <AddToColleagueListDialog
          open={teamDialogOpen}
          onOpenChange={(open) => {
            setTeamDialogOpen(open);
            if (!open) setSelectedApplicationForTeam(null);
          }}
          teamMembers={teamMembers}
          applicationId={selectedApplicationForTeam.id}
          applicantId={selectedApplicationForTeam.applicant_id}
          jobId={selectedApplicationForTeam.job_id}
          candidateName={`${selectedApplicationForTeam.first_name || ''} ${selectedApplicationForTeam.last_name || ''}`.trim() || 'Kandidat'}
        />
      )}
    </>
  );
};
