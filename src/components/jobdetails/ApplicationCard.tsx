import { memo } from 'react';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { CriterionIconBadge } from '@/components/JobCriteriaManager';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCompactTime } from '@/lib/date';
import { ArrowDown, Clock, Star } from 'lucide-react';
import type { JobApplication } from '@/hooks/useJobDetailsData';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Star rating component - read-only for cards
export const StarRating = ({ rating = 0, maxStars = 5 }: { rating?: number; maxStars?: number }) => {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }).map((_, i) => (
        <Star 
          key={i}
          className={`h-2.5 w-2.5 ${
            i < rating 
              ? 'text-amber-400 fill-amber-400' 
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
};

// Small Candidate Avatar Wrapper
const SmallCandidateAvatarWrapper = memo(({ application }: { application: JobApplication }) => {
  const hasVideo = application.is_profile_video && application.video_url;

  return (
    <div 
      className="h-8 w-8 flex-shrink-0 [&>*:first-child]:h-8 [&>*:first-child]:w-8 [&_.h-10]:h-8 [&_.w-10]:w-8 [&_.ring-2]:ring-1"
      onClick={hasVideo ? (e) => {
        e.stopPropagation();
      } : undefined}
    >
      <CandidateAvatar
        profileImageUrl={application.profile_image_url}
        videoUrl={application.video_url}
        isProfileVideo={application.is_profile_video}
        firstName={application.first_name}
        lastName={application.last_name}
        stopPropagation={!!hasVideo}
      />
    </div>
  );
});
SmallCandidateAvatarWrapper.displayName = 'SmallCandidateAvatarWrapper';

// Application Card Content
export const ApplicationCardContent = memo(({ 
  application, 
  isDragging, 
  onOpenProfile,
  onMarkAsViewed,
  onPrefetch,
  criteriaCount = 0,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: { 
  application: JobApplication; 
  isDragging?: boolean; 
  onOpenProfile?: () => void;
  onMarkAsViewed?: (id: string) => void;
  onPrefetch?: () => void;
  criteriaCount?: number;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) => {
  const isUnread = !application.viewed_at;
  const appliedTime = formatCompactTime(application.applied_at);
  const lastActiveTime = formatCompactTime(application.last_active_at);
  const criterionResults = application.criterionResults || [];
  
  const hasCriteria = criteriaCount > 0;
  const hasResults = criterionResults.length > 0;
  
  const handleClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
    } else {
      if (isUnread && onMarkAsViewed) {
        onMarkAsViewed(application.id);
      }
      onOpenProfile?.();
    }
  };
  
  return (
    <div 
      className={`bg-foreground/5 ring-1 ring-inset rounded-md px-2 py-1.5 group relative
        transition-all duration-200 ease-out
        ${isSelectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        ${isSelected 
          ? 'ring-1 ring-foreground/30 bg-foreground/[0.08]' 
          : isDragging 
            ? 'ring-2 ring-inset ring-primary/50 bg-foreground/10 scale-[1.02] shadow-lg shadow-primary/20' 
            : 'ring-foreground/10 hover:ring-foreground/30 hover:bg-foreground/[0.08] hover:-translate-y-0.5 hover:shadow-md hover:shadow-background/20'
        }`}
      onClick={handleClick}
      onMouseEnter={onPrefetch}
    >
      {isSelectionMode && (
        <div className="absolute left-1.5 top-1.5 z-10">
          <Checkbox 
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            className="h-3.5 w-3.5 border border-foreground/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-foreground hover:border-foreground/70"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {isUnread && !isSelectionMode && (
        <div className="absolute right-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
      )}
      
      <div className={`flex items-center gap-2 ${isSelectionMode ? 'ml-5' : ''}`}>
        <SmallCandidateAvatarWrapper application={application} />
        
        <div className="flex-1 min-w-0 pr-4">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-primary-foreground font-medium text-xs truncate group-hover:text-primary-foreground/80 transition-colors cursor-default">
                  {application.first_name} {application.last_name}
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{application.first_name} {application.last_name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <StarRating rating={application.rating} />
          {(appliedTime || lastActiveTime) && (
            <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground text-[10px]">
              {appliedTime && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default">
                        <ArrowDown className="h-2.5 w-2.5" />
                        {appliedTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p>Ansökte till detta jobb</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {lastActiveTime && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default">
                        <Clock className="h-2.5 w-2.5" />
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

      {hasResults && (
        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-foreground/5">
          {criterionResults.map((cr) => (
            <CriterionIconBadge
              key={cr.criterion_id}
              result={cr.result}
              title={cr.title}
            />
          ))}
        </div>
      )}
    </div>
  );
});
ApplicationCardContent.displayName = 'ApplicationCardContent';

// Sortable Application Card
export const SortableApplicationCard = memo(({ 
  application, 
  onOpenProfile,
  onMarkAsViewed,
  onPrefetch,
  criteriaCount = 0,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: { 
  application: JobApplication; 
  onOpenProfile: () => void;
  onMarkAsViewed?: (id: string) => void;
  onPrefetch?: () => void;
  criteriaCount?: number;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: application.id,
    disabled: isSelectionMode,
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
  };

  const dragProps = isSelectionMode ? {} : { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style} {...dragProps}>
      <ApplicationCardContent 
        application={application} 
        isDragging={isDragging} 
        onOpenProfile={onOpenProfile}
        onMarkAsViewed={onMarkAsViewed}
        onPrefetch={onPrefetch}
        criteriaCount={criteriaCount}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
};
