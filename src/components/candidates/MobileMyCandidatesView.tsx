import { memo, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { getIconByName, type CandidateStage } from '@/hooks/useStageSettings';
import { StageSettingsMenu } from '@/components/StageSettingsMenu';
import { CreateStageDialog } from '@/components/CreateStageDialog';
import { formatCompactTime } from '@/lib/date';
import { Star, ChevronRight, Plus, ArrowDown, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDragScroll } from '@/hooks/useDragScroll';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MyCandidateData } from '@/hooks/useMyCandidatesData';

/* ── Star Rating ─────────────────────────────────────── */
const StarRating = ({ rating = 0 }: { rating?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-2.5 w-2.5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`}
      />
    ))}
  </div>
);

/* ── Candidate Row ───────────────────────────────────── */
interface CandidateRowProps {
  candidate: MyCandidateData;
  onOpen: () => void;
  onMoveToStage: (id: string, stage: CandidateStage) => void;
  stages: string[];
  stageConfig: Record<string, { label: string; color: string; iconName: string }>;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onPrefetch?: () => void;
  onMarkAsViewed?: () => void;
}

const MyCandidateRow = memo(function MyCandidateRow({
  candidate,
  onOpen,
  onMoveToStage,
  stages,
  stageConfig,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onPrefetch,
  onMarkAsViewed,
}: CandidateRowProps) {
  const isUnread = !candidate.viewed_at;
  const appliedTime = formatCompactTime(candidate.applied_at);
  const lastActiveTime = formatCompactTime(candidate.last_active_at);

  const handleTap = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
      return;
    }
    if (isUnread && onMarkAsViewed) {
      onMarkAsViewed();
    }
    onOpen();
  };

  const moveTargets = stages.filter(s => s !== candidate.stage);

  return (
    <div
      className={`bg-white/5 ring-1 ring-inset rounded-md px-2 py-1.5 flex items-center gap-2 transition-all duration-200 ease-out min-h-touch relative group
        ${isSelected ? 'ring-white/30 bg-white/[0.08]' : 'ring-white/10 active:bg-white/[0.08] active:scale-[0.98]'}
        ${isSelectionMode ? 'cursor-pointer' : ''}`}
      onClick={handleTap}
      onMouseEnter={onPrefetch}
    >
      {/* Unread dot — top-right like JobDetails */}
      {!isSelectionMode && isUnread && (
        <div className="absolute right-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}

      {/* Selection checkbox */}
      {isSelectionMode && (
        <div className="absolute left-1.5 top-1.5 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            className="h-3.5 w-3.5 border border-white/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Avatar */}
      <div className={`h-10 w-10 flex-shrink-0 [&>*:first-child]:h-10 [&>*:first-child]:w-10 ${isSelectionMode ? 'ml-5' : ''}`}>
        <CandidateAvatar
          profileImageUrl={candidate.profile_image_url}
          videoUrl={candidate.video_url}
          isProfileVideo={candidate.is_profile_video}
          firstName={candidate.first_name}
          lastName={candidate.last_name}
          stopPropagation
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-white font-medium text-sm truncate">
          {candidate.first_name} {candidate.last_name}
        </p>
        <StarRating rating={candidate.rating} />
        {candidate.job_title && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-white text-[11px] truncate max-w-[120px] block cursor-default">
                {candidate.job_title}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px]">
              <p className="text-sm break-words">{candidate.job_title}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {(appliedTime || lastActiveTime) && (
          <div className="flex items-center gap-1.5 mt-0.5 text-white text-[10px]">
            {appliedTime && (
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
            )}
            {lastActiveTime && (
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
            )}
          </div>
        )}
      </div>

      {/* Right side — move menu (hidden in selection mode) */}
      {!isSelectionMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-white/5 active:bg-white/15 transition-colors flex-shrink-0"
              aria-label="Flytta kandidat"
            >
              <ChevronRight className="h-4 w-4 text-white/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {moveTargets.map(stage => {
              const cfg = stageConfig[stage];
              if (!cfg) return null;
              const Icon = getIconByName(cfg.iconName);
              return (
                <DropdownMenuItem
                  key={stage}
                  onClick={e => {
                    e.stopPropagation();
                    onMoveToStage(candidate.id, stage);
                  }}
                  className="gap-2"
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                  {cfg.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});

/* ── Main Mobile My Candidates View ──────────────────── */
interface MobileMyCandidatesViewProps {
  candidates: MyCandidateData[];
  stages: string[];
  stageConfig: Record<string, { label: string; color: string; iconName: string; isCustom?: boolean }>;
  onOpenProfile: (candidate: MyCandidateData) => void;
  onMoveToStage: (id: string, stage: CandidateStage) => void;
  onMoveCandidatesAndDelete: (fromStage: string, toStage: string) => Promise<void>;
  isReadOnly?: boolean;
  isSelectionMode?: boolean;
  selectedCandidateIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  renderActionBar?: React.ReactNode;
  onPrefetch?: (candidate: MyCandidateData) => void;
  onMarkAsViewed?: (applicationId: string) => void;
}

export const MobileMyCandidatesView = memo(function MobileMyCandidatesView({
  candidates,
  stages,
  stageConfig,
  onOpenProfile,
  onMoveToStage,
  onMoveCandidatesAndDelete,
  isReadOnly,
  isSelectionMode,
  selectedCandidateIds,
  onToggleSelect,
  renderActionBar,
  onPrefetch,
  onMarkAsViewed,
}: MobileMyCandidatesViewProps) {
  const [activeTab, setActiveTab] = useState(stages[0] || 'to_contact');
  const [menuOpenStage, setMenuOpenStage] = useState<string | null>(null);
  const lastCardTapRef = useRef<{ stage: string; time: number }>({ stage: '', time: 0 });
  const DOUBLE_TAP_MS = 320;
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  const scrollingRef = useRef(false);
  const touchGestureRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    blockMenuUntil: 0,
  });

  const handleStageTabsTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchGestureRef.current.startX = touch.clientX;
    touchGestureRef.current.startY = touch.clientY;
    touchGestureRef.current.moved = false;
    scrollingRef.current = false;
  }, []);

  const handleStageTabsTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchGestureRef.current.startX);
    const deltaY = Math.abs(touch.clientY - touchGestureRef.current.startY);

    if (deltaX > 6 || deltaY > 6) {
      touchGestureRef.current.moved = true;
      scrollingRef.current = true;
      touchGestureRef.current.blockMenuUntil = Date.now() + 260;
    }
  }, []);

  const handleStageTabsTouchEnd = useCallback(() => {
    if (touchGestureRef.current.moved) {
      touchGestureRef.current.blockMenuUntil = Date.now() + 260;
    }
    touchGestureRef.current.moved = false;
    scrollingRef.current = false;
  }, []);

  const shouldBlockStageMenuInteraction = useCallback(() => {
    return scrollingRef.current || Date.now() < touchGestureRef.current.blockMenuUntil;
  }, []);

  const candidatesByStage = useMemo(() => {
    const result: Record<string, MyCandidateData[]> = {};
    stages.forEach(s => (result[s] = []));
    candidates.forEach(c => {
      if (result[c.stage]) {
        result[c.stage].push(c);
      } else {
        const firstStage = stages[0];
        if (firstStage) result[firstStage].push(c);
      }
    });
    return result;
  }, [candidates, stages]);

  const currentCandidates = candidatesByStage[activeTab] || [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3">
        {/* Horizontal scrollable stage tabs */}
        <div
          ref={dragScrollRef}
          onTouchStart={handleStageTabsTouchStart}
          onTouchMove={handleStageTabsTouchMove}
          onTouchEnd={handleStageTabsTouchEnd}
          className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 touch-pan-x cursor-grab active:cursor-grabbing select-none [touch-action:pan-x] [-webkit-overflow-scrolling:touch] overscroll-x-contain"
        >
          {stages.map((stage, stageIdx) => {
            const cfg = stageConfig[stage];
            if (!cfg) return null;
            const Icon = getIconByName(cfg.iconName);
            const count = (candidatesByStage[stage] || []).length;
            const isActive = stage === activeTab;

            const targetIdx = stageIdx === 0 ? 1 : 0;
            const targetStageKey = stages[targetIdx];
            const targetStageLabel = stageConfig[targetStageKey]?.label;

            return (
              <div
                key={stage}
                data-stage-tab
                tabIndex={0}
                onClick={() => {
                  if (shouldBlockStageMenuInteraction()) return;
                  setActiveTab(stage);
                  const now = Date.now();
                  const last = lastCardTapRef.current;
                  if (last.stage === stage && now - last.time <= DOUBLE_TAP_MS) {
                    lastCardTapRef.current = { stage: '', time: 0 };
                    setMenuOpenStage(stage);
                    return;
                  }
                  lastCardTapRef.current = { stage, time: now };
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(stage); } }}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium text-white whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 ring-1 ring-inset backdrop-blur-sm cursor-pointer max-w-[180px] touch-manipulation ${
                  isActive
                    ? 'ring-white/40 shadow-lg'
                    : 'ring-transparent'
                }`}
                style={{ backgroundColor: `${cfg.color}55`, WebkitTapHighlightColor: 'transparent' }}
              >
                <Icon className="h-3 w-3 text-white flex-shrink-0" />
                {cfg.label.length > 10 ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate cursor-default min-w-0">{cfg.label}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] break-words whitespace-normal">
                        <p className="text-sm break-words whitespace-pre-wrap">{cfg.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="truncate min-w-0">{cfg.label}</span>
                )}
                <span
                  className="h-4 min-w-4 px-0.5 inline-grid place-items-center rounded-full text-[9px] text-white flex-shrink-0 tabular-nums"
                  style={{ backgroundColor: `${cfg.color}88` }}
                >
                  <span className="translate-y-[0.25px]">{count}</span>
                </span>
                {!isReadOnly && (
                  <span>
                    <StageSettingsMenu
                      stageKey={stage}
                      candidateCount={count}
                      totalStageCount={stages.length}
                      targetStageKey={targetStageKey}
                      targetStageLabel={targetStageLabel}
                      onMoveCandidatesAndDelete={onMoveCandidatesAndDelete}
                      useJobDetailsTriggerStyle
                      requireLongPressOnMobile
                      touchVisualOnlyTrigger
                      controlledOpen={menuOpenStage === stage}
                      onControlledOpenChange={(open) => setMenuOpenStage(open ? stage : null)}
                    />
                  </span>
                )}
              </div>
            );
          })}

          {/* Add new stage button */}
          {!isReadOnly && stages.length < 8 && (
            <CreateStageDialog
              trigger={
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap bg-white/5 text-white ring-1 ring-inset ring-white/10 active:scale-95 transition-all shrink-0 backdrop-blur-sm">
                  <Plus className="h-3.5 w-3.5" />
                  Nytt steg
                </button>
              }
            />
          )}
        </div>

        {/* Candidate list */}
        <ScrollArea className="overscroll-contain" style={{ maxHeight: 'calc(100dvh - 340px)' }}>
          <div className="flex flex-col gap-1.5">
            {currentCandidates.length === 0 ? (
              <div className="text-center py-12 text-sm text-white">
                Inga kandidater i detta steg
              </div>
            ) : (
              currentCandidates.map((candidate) => (
                <MyCandidateRow
                  key={candidate.id}
                  candidate={candidate}
                  onOpen={() => onOpenProfile(candidate)}
                  onMoveToStage={onMoveToStage}
                  stages={stages}
                  stageConfig={stageConfig}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedCandidateIds?.has(candidate.id)}
                  onToggleSelect={() => onToggleSelect?.(candidate.id)}
                  onPrefetch={() => onPrefetch?.(candidate)}
                  onMarkAsViewed={() => onMarkAsViewed?.(candidate.application_id)}
                />
              ))
            )}
            {isSelectionMode && currentCandidates.length > 0 && <div className="h-2" />}
          </div>
        </ScrollArea>

        {/* Inline action bar for selection mode */}
        {renderActionBar}
      </div>
    </TooltipProvider>
  );
});
