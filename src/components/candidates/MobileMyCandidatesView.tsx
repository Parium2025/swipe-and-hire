import { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
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
import { useTouchCapable } from '@/hooks/useInputCapability';
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

  const rowRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuMetrics, setMenuMetrics] = useState({ width: 0, alignOffset: 0 });

  const measureMenuMetrics = useCallback(() => {
    const rowEl = rowRef.current;
    const triggerEl = triggerRef.current;
    if (!rowEl || !triggerEl) return;

    const rowRect = rowEl.getBoundingClientRect();
    const triggerRect = triggerEl.getBoundingClientRect();
    const nextWidth = Math.round(rowRect.width);
    const nextAlignOffset = Math.round(rowRect.left - triggerRect.left);

    setMenuMetrics((prev) =>
      prev.width === nextWidth && prev.alignOffset === nextAlignOffset
        ? prev
        : { width: nextWidth, alignOffset: nextAlignOffset }
    );
  }, []);

  useEffect(() => {
    measureMenuMetrics();

    const rowEl = rowRef.current;
    if (!rowEl || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      measureMenuMetrics();
    });

    observer.observe(rowEl);
    return () => observer.disconnect();
  }, [measureMenuMetrics]);

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
      className={`bg-white/5 ring-1 ring-inset rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] transition-all duration-150 min-h-touch relative
        ${isSelected ? 'ring-white/40 bg-white/[0.10]' : 'ring-white/10 active:scale-[0.98]'}
        ${isSelectionMode ? 'cursor-pointer' : ''}`}
      ref={rowRef}
      onClick={handleTap}
      onMouseEnter={onPrefetch}
    >
      {!isSelectionMode && isUnread && (
        <div className="absolute left-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}

      {/* Avatar */}
      <div className="h-10 w-10 flex-shrink-0 [&>*:first-child]:h-10 [&>*:first-child]:w-10 [&_.h-10]:h-10 [&_.w-10]:w-10">
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
      <div className="flex-1 min-w-0">
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

      {/* Right side: checkbox in selection mode, otherwise move stage dropdown */}
      {isSelectionMode ? (
        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            className="h-3.5 w-3.5 border border-white/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-white"
          />
        </div>
      ) : (
        <DropdownMenu onOpenChange={(open) => open && measureMenuMetrics()}>
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              onPointerDownCapture={measureMenuMetrics}
              onClick={e => e.stopPropagation()}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-white/5 active:scale-[0.97] transition-colors flex-shrink-0"
              aria-label="Flytta kandidat"
            >
              <ChevronRight className="h-4 w-4 text-white/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            alignOffset={menuMetrics.alignOffset}
            avoidCollisions={false}
            className="max-w-none"
            style={{ width: menuMetrics.width ? `${menuMetrics.width}px` : 'calc(100vw - 2rem)' }}
          >
            {moveTargets.map(stage => {
              const cfg = stageConfig[stage];
              if (!cfg) return null;
              const Icon = getIconByName(cfg.iconName);
              return (
                <TooltipProvider key={stage} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem
                        onClick={e => {
                          e.stopPropagation();
                          onMoveToStage(candidate.id, stage);
                        }}
                        className="gap-2 min-h-[44px] min-w-0"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-white" />
                        <span className="truncate min-w-0">{cfg.label}</span>
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    {cfg.label.length > 20 && (
                      <TooltipContent side="bottom" align="center" sideOffset={8} className="max-w-[280px] break-words whitespace-normal z-[999999]">
                        <p className="text-sm break-words whitespace-pre-wrap">{cfg.label}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
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
  const [openStageMenu, setOpenStageMenu] = useState<string | null>(null);
  const lastTouchTapRef = useRef<{ stage: string; time: number } | null>(null);
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  const isTouchCapable = useTouchCapable();
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll the tab strip to keep the active tab visible
  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Swipe between stage tabs
  const swipeToNextStage = useCallback(() => {
    const idx = stages.indexOf(activeTab);
    if (idx < stages.length - 1) setActiveTab(stages[idx + 1]);
  }, [activeTab, stages]);
  const swipeToPrevStage = useCallback(() => {
    const idx = stages.indexOf(activeTab);
    if (idx > 0) setActiveTab(stages[idx - 1]);
  }, [activeTab, stages]);
  const stageSwipeHandlers = useSwipeGesture({ onSwipeLeft: swipeToNextStage, onSwipeRight: swipeToPrevStage, threshold: 50 });

  const handleStageClick = useCallback((stage: string) => {
    setActiveTab(stage);
    setOpenStageMenu((prev) => (prev && prev !== stage ? null : prev));
  }, []);

  const handleStagePointerDown = useCallback((stage: string, pointerType: string) => {
    // Mouse: handled by onClick. Touch/pen: only track double-tap for settings menu.
    // Do NOT switch activeTab here — let onClick handle it after scroll gesture resolves.
    if (pointerType === 'mouse') return;

    if (isReadOnly) return;

    const now = Date.now();
    const lastTap = lastTouchTapRef.current;
    const isDoubleTap = !!lastTap && lastTap.stage === stage && now - lastTap.time <= 320;

    if (isDoubleTap) {
      setOpenStageMenu(stage);
      lastTouchTapRef.current = null;
      return;
    }

    lastTouchTapRef.current = { stage, time: now };
  }, [isReadOnly]);

  useEffect(() => {
    if (stages.length === 0) return;
    if (!stages.includes(activeTab)) {
      setActiveTab(stages[0]);
    }
  }, [stages, activeTab]);

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
      <div className="flex flex-col gap-3 flex-1 min-h-0">
...
        {/* Candidate list — fills remaining space so swipe works on empty area too */}
        <div
          className="flex-1 min-h-[40vh]"
          onTouchStart={stageSwipeHandlers.onTouchStart}
          onTouchMove={stageSwipeHandlers.onTouchMove}
          onTouchEnd={stageSwipeHandlers.onTouchEnd}
        >
          <ScrollArea className="overscroll-contain touch-pan-y h-full" style={{ maxHeight: 'calc(100dvh - 340px)' }}>
            <div className="flex flex-col gap-2">
              {currentCandidates.length === 0 ? (
                <div className="text-center py-12 text-sm text-white min-h-[40vh] flex items-center justify-center">
                  <span>Inga kandidater i detta steg</span>
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
        </div>

      </div>
    </TooltipProvider>
  );
});
