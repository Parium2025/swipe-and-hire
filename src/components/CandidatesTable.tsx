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
import { UserPlus, Clock, Loader2, Star, Users, Trash2, MoreHorizontal, CheckSquare, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCvSummaryPreloader } from '@/hooks/useCvSummaryPreloader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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
}

const statusConfig = {
  pending: { label: 'Ny', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30 group-hover:backdrop-brightness-90 hover:bg-blue-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
  reviewing: { label: 'Granskas', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 group-hover:backdrop-brightness-90 hover:bg-yellow-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
  accepted: { label: 'Accepterad', className: 'bg-green-500/20 text-green-300 border-green-500/30 group-hover:backdrop-brightness-90 hover:bg-green-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
  rejected: { label: 'Avvisad', className: 'bg-red-500/20 text-red-300 border-red-500/30 group-hover:backdrop-brightness-90 hover:bg-red-500/30 hover:backdrop-brightness-110 transition-all duration-300' },
};

export function CandidatesTable({ 
  applications, 
  onUpdate, 
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  selectionMode = false,
  onSelectionModeChange,
}: CandidatesTableProps) {
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isInMyCandidates, addCandidate } = useMyCandidatesData();
  const { teamMembers, hasTeam } = useTeamMembers();
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = applications.length > 0 && selectedIds.size === applications.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < applications.length;

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

  // Get average rating for an application from team candidates
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
        <div className="mb-4 p-3 rounded-xl bg-white/[0.03] backdrop-blur-md border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80 font-medium">
              {selectedIds.size > 0 
                ? `${selectedIds.size} kandidat${selectedIds.size !== 1 ? 'er' : ''} markerad${selectedIds.size !== 1 ? 'e' : ''}`
                : 'Välj kandidater i listan'
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Avmarkera
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/80 hover:text-white hover:bg-white/10 border border-white/10"
                    >
                      Åtgärder
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-md border-white/10">
                    <DropdownMenuItem className="text-white cursor-pointer hover:bg-white/10">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Lägg till i Mina kandidater
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive cursor-pointer hover:bg-white/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Ta bort
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5 hover:border-white/50">
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
                    className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-background"
                  />
                </TableHead>
              )}
              <TableHead className="text-white">Kandidat</TableHead>
              <TableHead className="text-white">Betyg</TableHead>
              <TableHead className="text-white">Tjänst</TableHead>
              <TableHead className="text-white">Ansökt</TableHead>
              <TableHead className="text-white">Senaste aktivitet</TableHead>
              <TableHead className="text-white w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => {
              const status = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending;
              const isAlreadyAdded = isInMyCandidates(application.id);
              const teamInfo = getTeamInfo(application.id);
              const isSelected = selectedIds.has(application.id);
              
              return (
                <TableRow
                  key={application.id}
                  className={cn(
                    "group border-white/10 hover:bg-white/5 hover:border-white/50 cursor-pointer transition-all duration-150 active:bg-white/10",
                    isSelected && "bg-white/10"
                  )}
                  onClick={() => handleRowClick(application)}
                >
                  {selectionMode && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleSelect(application.id, e)}
                        className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-background"
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
                    {teamInfo && teamInfo.maxRating > 0 ? (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              "h-3.5 w-3.5",
                              star <= teamInfo.maxRating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-white/20"
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-white/30 text-sm">–</span>
                    )}
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
                    {!isAlreadyAdded && (
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
      
      {/* Infinite scroll sentinel */}
      {hasMore && (
        <InfiniteScrollSentinel 
          onIntersect={onLoadMore} 
          isLoading={isLoadingMore} 
        />
      )}

      <CandidateProfileDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onStatusUpdate={() => {
          onUpdate();
          handleDialogClose();
        }}
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
