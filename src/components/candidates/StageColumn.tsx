import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getIconByName, type CandidateStage } from '@/hooks/useStageSettings';
import { StageSettingsMenu } from '@/components/StageSettingsMenu';
import { SortableCandidateCard } from './KanbanCandidateCard';
import type { MyCandidateData } from '@/hooks/useMyCandidatesData';

export interface StageColumnProps {
  stage: CandidateStage;
  candidates: MyCandidateData[];
  onMoveCandidate: (id: string, stage: CandidateStage) => void;
  onRemoveCandidate: (candidate: MyCandidateData) => void;
  onOpenProfile: (candidate: MyCandidateData) => void;
  onPrefetch?: (candidate: MyCandidateData) => void;
  stageSettings: { label: string; color: string; iconName: string };
  isReadOnly?: boolean;
  totalStageCount: number;
  targetStageKey: string;
  targetStageLabel: string;
  onMoveCandidatesAndDelete: (fromStage: string, toStage: string) => Promise<void>;
  isSelectionMode?: boolean;
  selectedCandidateIds?: Set<string>;
  onToggleSelect?: (candidateId: string) => void;
}

export const StageColumn = ({
  stage,
  candidates,
  onRemoveCandidate,
  onOpenProfile,
  onPrefetch,
  stageSettings,
  isReadOnly,
  totalStageCount,
  targetStageKey,
  targetStageLabel,
  onMoveCandidatesAndDelete,
  isSelectionMode,
  selectedCandidateIds,
  onToggleSelect,
}: Omit<StageColumnProps, 'onMoveCandidate'>) => {
  const Icon = getIconByName(stageSettings.iconName);
  const [liveColor, setLiveColor] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    disabled: isReadOnly,
  });

  const displayColor = liveColor ?? stageSettings.color;

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
  }, [candidates.length, checkScroll]);

  return (
    <div
      ref={setNodeRef}
      className="flex-none w-[calc((100%-3rem)/5)] flex flex-col transition-colors h-full min-w-0"
    >
      <div
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-white/20 backdrop-blur-sm flex-shrink-0 ${
          isOver ? 'ring-2 ring-white/40' : ''
        }`}
        style={{ backgroundColor: `${displayColor}33` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-xs text-white truncate cursor-default flex-1 min-w-0">
                  {stageSettings.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{stageSettings.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span
            className="text-white text-[10px] h-4 min-w-4 px-1 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: `${displayColor}66` }}
          >
            {candidates.length}
          </span>
          {!isReadOnly && (
            <div className="ml-auto">
              <StageSettingsMenu
                stageKey={stage}
                candidateCount={candidates.length}
                totalStageCount={totalStageCount}
                targetStageKey={targetStageKey}
                targetStageLabel={targetStageLabel}
                onMoveCandidatesAndDelete={onMoveCandidatesAndDelete}
                onLiveColorChange={setLiveColor}
              />
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 bg-white/5 rounded-lg ring-1 ring-inset ring-white/10 backdrop-blur-sm">
        {canScrollUp && (
          <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white/5 to-transparent z-10 pointer-events-none rounded-t-lg" />
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="h-full overflow-y-auto space-y-1.5 p-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/30"
        >
          {isOver && (
            <div className="mb-2 flex items-center justify-center">
              <div className="rounded-md bg-white/10 backdrop-blur-sm ring-1 ring-inset ring-white/20 px-4 py-3 text-xs font-medium text-white animate-pulse">
                Släpp här
              </div>
            </div>
          )}

          <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {candidates.map((candidate) => (
              <SortableCandidateCard
                key={candidate.id}
                candidate={candidate}
                onRemove={() => onRemoveCandidate(candidate)}
                onOpenProfile={() => onOpenProfile(candidate)}
                onPrefetch={onPrefetch ? () => onPrefetch(candidate) : undefined}
                isSelectionMode={isSelectionMode}
                isSelected={selectedCandidateIds?.has(candidate.id)}
                onToggleSelect={() => onToggleSelect?.(candidate.id)}
              />
            ))}
          </SortableContext>

          {candidates.length === 0 && !isOver && (
            <div className="text-center py-8 text-xs text-white">
              Inga kandidater i detta steg
            </div>
          )}
        </div>

        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/5 to-transparent z-10 pointer-events-none rounded-b-lg flex items-end justify-center pb-1">
            <div className="animate-bounce">
              <ChevronDown className="h-3.5 w-3.5 text-white/60" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
