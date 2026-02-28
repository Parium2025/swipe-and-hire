import { memo } from 'react';
import { Star, UserPlus, Users, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { formatTimeAgo } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { ApplicationData } from '@/hooks/useApplicationsData';

interface TeamInfo {
  avgRating: number;
  maxRating: number;
  colleagues: string[];
  count: number;
}

interface MobileCandidateCardProps {
  application: ApplicationData;
  rating: number;
  teamInfo: TeamInfo | null;
  isAlreadyAdded: boolean;
  isMyCandidatesLoading: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  hasTeam: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onAddCandidate: () => void;
  onAddToTeam: () => void;
}

export const MobileCandidateCard = memo(function MobileCandidateCard({
  application,
  rating,
  teamInfo,
  isAlreadyAdded,
  isMyCandidatesLoading,
  selectionMode,
  isSelected,
  hasTeam,
  onToggleSelect,
  onClick,
  onAddCandidate,
  onAddToTeam,
}: MobileCandidateCardProps) {
  return (
    <div
      className={cn(
        "bg-white/5 ring-1 ring-inset ring-white/10 rounded-lg p-3 active:scale-[0.98] transition-all duration-150 cursor-pointer",
        isSelected && "ring-white/30 bg-white/[0.08]"
      )}
      onClick={selectionMode ? onToggleSelect : onClick}
    >
      <div className="flex items-center gap-3">
        {/* Selection checkbox */}
        {selectionMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              const nextChecked = checked === true;
              if (nextChecked !== isSelected) onToggleSelect();
            }}
            className="h-4 w-4 flex-shrink-0 border-white/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-white"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Avatar */}
        <div className="flex-shrink-0">
          <CandidateAvatar
            profileImageUrl={application.profile_image_url}
            videoUrl={application.video_url}
            isProfileVideo={application.is_profile_video}
            firstName={application.first_name}
            lastName={application.last_name}
            stopPropagation
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm truncate">
              {application.first_name} {application.last_name}
            </span>
            {teamInfo && teamInfo.colleagues.length > 0 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
                <Users className="h-2.5 w-2.5 text-purple-300" />
                <span className="text-[9px] text-purple-300 font-medium">
                  {teamInfo.colleagues.length}
                </span>
              </div>
            )}
          </div>

          {/* Rating stars */}
          {rating > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-2.5 w-2.5",
                    star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-white/30"
                  )}
                />
              ))}
            </div>
          )}

          {/* Job title with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-white truncate mt-0.5 cursor-default">
                {application.job_title || 'Okänd tjänst'}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px]">
              <p className="text-sm break-words">{application.job_title || 'Okänd tjänst'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Time since last activity — crisp white */}
          <span className="text-[11px] text-white mt-0.5 block">
            {formatTimeAgo(application.applied_at)}
          </span>
        </div>

        {/* Right side: add button or chevron */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isMyCandidatesLoading && !isAlreadyAdded && !selectionMode && (
            <button
              className="h-8 w-8 flex items-center justify-center rounded-full text-white active:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                if (hasTeam) {
                  onAddToTeam();
                } else {
                  onAddCandidate();
                }
              }}
            >
              <UserPlus className="h-4 w-4" />
            </button>
          )}
          {!selectionMode && (
            <ChevronRight className="h-4 w-4 text-white flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
});
