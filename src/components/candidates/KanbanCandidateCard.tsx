import { memo } from 'react';
import { Star, Trash2, ArrowDown, Clock } from 'lucide-react';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCompactTime } from '@/lib/date';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MyCandidateData } from '@/hooks/useMyCandidatesData';

/* ── Star Rating (read-only) ──────────────────────── */
const StarRating = ({ rating = 0, maxStars = 5 }: { rating?: number; maxStars?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: maxStars }).map((_, i) => (
      <Star
        key={i}
        className={`h-2.5 w-2.5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`}
      />
    ))}
  </div>
);

/* ── Small Avatar with inline video ────────────────── */
const SmallCandidateAvatar = ({ candidate }: { candidate: MyCandidateData }) => {
  const hasVideo = candidate.is_profile_video && candidate.video_url;

  return (
    <div
      className="h-8 w-8 flex-shrink-0 [&>*:first-child]:h-8 [&>*:first-child]:w-8 [&_.h-10]:h-8 [&_.w-10]:w-8 [&_.ring-2]:ring-1"
      onClick={hasVideo ? (e) => e.stopPropagation() : undefined}
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

/* ── Card Props ────────────────────────────────────── */
export interface KanbanCandidateCardProps {
  candidate: MyCandidateData;
  onRemove: () => void;
  onOpenProfile: () => void;
  onPrefetch?: () => void;
  isDragging?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

/* ── Card Content (visual) ─────────────────────────── */
export const CandidateCardContent = memo(function CandidateCardContent({
  candidate,
  onRemove,
  onOpenProfile,
  onPrefetch,
  isDragging,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: KanbanCandidateCardProps) {
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
        ${
          isSelected
            ? 'ring-1 ring-white/30 bg-white/[0.08]'
            : isDragging
            ? 'ring-2 ring-inset ring-primary/50 bg-white/10 scale-[1.02] shadow-lg shadow-primary/20'
            : 'ring-white/10 hover:ring-white/30 hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20'
        }`}
      onClick={handleClick}
      onMouseEnter={onPrefetch}
    >
      {/* Selection checkbox */}
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

      {/* Unread indicator */}
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
                <p>
                  {candidate.first_name} {candidate.last_name}
                </p>
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

      {/* Remove button */}
      {!isSelectionMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-1 top-1 p-1 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-full
            opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});

/* ── Sortable Wrapper ──────────────────────────────── */
export const SortableCandidateCard = (props: KanbanCandidateCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.candidate.id,
    disabled: props.isSelectionMode,
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
  };

  const dragProps = props.isSelectionMode ? {} : { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style} {...dragProps}>
      <CandidateCardContent {...props} isDragging={isDragging} />
    </div>
  );
};
