import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
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
  /** Verkligt antal i kolumnen (från servern) — inte antalet nedladdade rader. */
  totalCount?: number;
  /** Finns fler kandidater att hämta i den här kolumnen? */
  hasMore?: boolean;
  /** Anropas när användaren scrollat nära botten (med kolumnens steg). */
  onLoadMore?: (stage: string) => void;
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
  totalCount,
  hasMore,
  onLoadMore,
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

  // ── Virtualisering (aktiveras först vid stora kolumner) ──
  const VIRTUALIZE_THRESHOLD = 60;
  const OVERSCAN = 10;
  const GAP = 6; // space-y-1.5
  const [itemHeight, setItemHeight] = useState(56);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  

  const isVirtual = candidates.length > VIRTUALIZE_THRESHOLD;

  // Håll senaste callbacken i en ref så scroll-lyssnaren aldrig behöver bindas om.
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasScrollableContent = el.scrollHeight > el.clientHeight;
    const isAtTop = el.scrollTop <= 5;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 5;
    setCanScrollUp(hasScrollableContent && !isAtTop);
    setCanScrollDown(hasScrollableContent && !isAtBottom);
    setScrollTop(el.scrollTop);
    setViewportHeight(el.clientHeight);

    // Ladda nästa sida i god tid — 600 px innan botten — så att nya kort redan
    // ligger på plats när användaren når dem.
    if (hasMoreRef.current && el.scrollTop + el.clientHeight >= el.scrollHeight - 600) {
      loadMoreRef.current?.(stageRef.current);
    }
  }, []);

  useEffect(() => {
    checkScroll();
  }, [candidates.length, checkScroll]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkScroll]);

  useLayoutEffect(() => {
    if (!isVirtual) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const card = Array.from(el.children).find(
      (child) => !(child as HTMLElement).dataset.spacer && (child as HTMLElement).offsetHeight > 20
    ) as HTMLElement | undefined;
    const h = card?.offsetHeight;
    if (h && Math.abs(h - itemHeight) > 1) setItemHeight(h);
  });

  const pitch = itemHeight + GAP;
  const { startIndex, endIndex } = useMemo(() => {
    if (!isVirtual) return { startIndex: 0, endIndex: candidates.length };
    const vh = viewportHeight || 600;
    const start = Math.max(0, Math.floor(scrollTop / pitch) - OVERSCAN);
    const visible = Math.ceil(vh / pitch) + OVERSCAN * 2;
    return { startIndex: start, endIndex: Math.min(candidates.length, start + visible) };
  }, [isVirtual, candidates.length, scrollTop, viewportHeight, pitch]);

  const visibleCandidates = isVirtual ? candidates.slice(startIndex, endIndex) : candidates;
  const topSpacer = isVirtual && startIndex > 0 ? startIndex * pitch - GAP : 0;
  const bottomSpacer =
    isVirtual && endIndex < candidates.length ? (candidates.length - endIndex) * pitch - GAP : 0;

  // Dynamic gap: (totalStageCount - 1) * 0.75rem
  const gapTotal = `${(totalStageCount - 1) * 0.75}rem`;

  return (
    <div
      ref={setNodeRef}
      className="flex-none flex flex-col transition-colors h-full min-w-0"
      style={{ width: `calc((100% - ${gapTotal}) / ${totalStageCount})` }}
    >
      <div
        className={`group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-white/20 flex-shrink-0 ${
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
              <TooltipContent side="top" className="max-w-[min(90vw,500px)] break-words whitespace-pre-wrap">
                <p className="break-words whitespace-pre-wrap">{stageSettings.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span
            className="text-white text-[10px] h-4 min-w-4 px-1 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ backgroundColor: `${displayColor}66` }}
          >
            {/* Sant totalantal från servern — nedladdade rader kan vara färre. */}
            {typeof totalCount === 'number' ? totalCount : candidates.length}
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

      <div className="relative flex-1 min-h-0 bg-white/5 rounded-lg ring-1 ring-inset ring-white/10">
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
              <div className="rounded-md bg-white/10 ring-1 ring-inset ring-white/20 px-4 py-3 text-xs font-medium text-white animate-pulse">
                Släpp här
              </div>
            </div>
          )}

          {topSpacer > 0 && <div data-spacer="top" style={{ height: topSpacer }} aria-hidden />}

          <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {visibleCandidates.map((candidate) => (
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

          {bottomSpacer > 0 && <div data-spacer="bottom" style={{ height: bottomSpacer }} aria-hidden />}


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
