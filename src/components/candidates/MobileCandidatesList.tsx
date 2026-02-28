import { useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MobileCandidateCard } from './MobileCandidateCard';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface TeamInfo {
  avgRating: number;
  maxRating: number;
  colleagues: string[];
  count: number;
}

interface MobileCandidatesListProps {
  applications: ApplicationData[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  isMyCandidatesLoading: boolean;
  hasTeam: boolean;
  getDisplayRating: (app: ApplicationData) => number;
  getTeamInfo: (appId: string) => TeamInfo | null;
  isInMyCandidates: (appId: string) => boolean;
  onToggleSelect: (id: string) => void;
  onRowClick: (app: ApplicationData) => void;
  onAddCandidate: (app: ApplicationData) => void;
  onAddToTeam: (app: ApplicationData) => void;
}

export function MobileCandidatesList({
  applications,
  selectedIds,
  selectionMode,
  isMyCandidatesLoading,
  hasTeam,
  getDisplayRating,
  getTeamInfo,
  isInMyCandidates,
  onToggleSelect,
  onRowClick,
  onAddCandidate,
  onAddToTeam,
}: MobileCandidatesListProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-2">
        {applications.map((application) => (
          <MobileCandidateCard
            key={application.id}
            application={application}
            rating={getDisplayRating(application)}
            teamInfo={getTeamInfo(application.id)}
            isAlreadyAdded={isInMyCandidates(application.id)}
            isMyCandidatesLoading={isMyCandidatesLoading}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(application.id)}
            hasTeam={hasTeam}
            onToggleSelect={() => onToggleSelect(application.id)}
            onClick={() => onRowClick(application)}
            onAddCandidate={() => onAddCandidate(application)}
            onAddToTeam={() => onAddToTeam(application)}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
