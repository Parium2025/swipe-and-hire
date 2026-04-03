import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, Sparkles } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { JobStageSettingsMenu } from '@/components/JobStageSettingsMenu';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import { SortableApplicationCard } from './ApplicationCard';
import type { JobApplication } from '@/hooks/useJobDetailsData';

export interface StatusColumnProps {
  jobId: string;
  status: string;
  applications: JobApplication[];
  onOpenProfile: (app: JobApplication) => void;
  onMarkAsViewed: (id: string) => void;
  onPrefetch?: (app: JobApplication) => void;
  onOpenCriteriaDialog?: () => void;
  stageConfig: {
    label: string;
    color: string;
    iconName: string;
    isCustom: boolean;
  };
  totalStageCount: number;
  criteriaCount?: number;
  isSelectionMode?: boolean;
  selectedApplicationIds?: Set<string>;
  onToggleSelect?: (applicationId: string) => void;
  targetStageKey?: string;
  targetStageLabel?: string;
  onMoveCandidatesAndDelete?: () => Promise<void>;
  stageIndex?: number;
}

export const StatusColumn = memo(({ 
  jobId,
  status, 
  applications, 
  onOpenProfile, 
  onMarkAsViewed, 
  onPrefetch,
  onOpenCriteriaDialog,
  stageConfig,
  totalStageCount,
  criteriaCount = 0,
  isSelectionMode,
  selectedApplicationIds,
  onToggleSelect,
  targetStageKey,
  targetStageLabel,
  onMoveCandidatesAndDelete,
  stageIndex = 0,
}: StatusColumnProps) => {
  const [liveColor, setLiveColor] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const displayColor = liveColor || stageConfig.color;
  const Icon = getJobStageIconByName(stageConfig.iconName);
  
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    const hasScrollableContent = el.scrollHeight > el.clientHeight;
    const isAtTop = el.scrollTop <= 5;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
    
    setCanScrollUp(hasScrollableContent && !isAtTop);
    setCanScrollDown(hasScrollableContent && !isAtBottom);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [applications.length, checkScroll]);

  // Listen for resize to update scroll indicators
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkScroll]);

  return (
    <div 
      ref={setNodeRef}
      className="flex-shrink-0 flex flex-col transition-colors h-full"
      style={{ 
        width: 'clamp(200px, 22vw, 260px)',
        minWidth: '180px',
      }}
    >
      <div 
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-foreground/20 flex-shrink-0 ${isOver ? 'ring-2 ring-foreground/40' : ''}`}
        style={{ backgroundColor: `${displayColor}55` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <TruncatedText
            text={stageConfig.label}
            className="font-medium text-xs text-white truncate flex-1 min-w-0"
          />
          <span 
            className="text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: `${displayColor}88` }}
          >
            {applications.length}
          </span>
          {onOpenCriteriaDialog && (
            <button
              onClick={onOpenCriteriaDialog}
              className="p-1 rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              title="Urvalskriterier"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="ml-auto">
            <JobStageSettingsMenu 
              jobId={jobId}
              stageKey={status}
              candidateCount={applications.length}
              totalStageCount={totalStageCount}
              targetStageKey={targetStageKey}
              targetStageLabel={targetStageLabel}
              onMoveCandidatesAndDelete={onMoveCandidatesAndDelete}
              onLiveColorChange={setLiveColor}
              stageIndex={stageIndex}
            />
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 rounded-lg border border-white/20 bg-white/5">
        {canScrollUp && (
          <div className="absolute top-0 left-0 right-0 z-10 h-6 rounded-t-lg bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        )}

        <div 
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="h-full overflow-y-auto space-y-1.5 p-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30"
        >
          {isOver && (
            <div className="mb-2 flex items-center justify-center">
              <div className="animate-pulse rounded-md border border-white/20 bg-white/10 px-4 py-3 text-xs font-medium text-white">
                Släpp här
              </div>
            </div>
          )}

          <SortableContext items={applications.map(a => a.id)} strategy={verticalListSortingStrategy}>
            {applications.map((app) => (
              <SortableApplicationCard 
                key={app.id} 
                application={app} 
                onOpenProfile={() => onOpenProfile(app)}
                onMarkAsViewed={onMarkAsViewed}
                onPrefetch={() => onPrefetch?.(app)}
                criteriaCount={criteriaCount}
                isSelectionMode={isSelectionMode}
                isSelected={selectedApplicationIds?.has(app.id)}
                onToggleSelect={() => onToggleSelect?.(app.id)}
              />
            ))}
          </SortableContext>

          {applications.length === 0 && !isOver && (
            <div className="py-8 text-center text-xs text-white">
              Inga kandidater i detta steg
            </div>
          )}
        </div>

        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex h-8 items-end justify-center rounded-b-lg bg-gradient-to-t from-white/10 to-transparent pb-1 pointer-events-none">
            <div className="animate-bounce">
              <ChevronDown className="h-3.5 w-3.5 text-white/70" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
StatusColumn.displayName = 'StatusColumn';
