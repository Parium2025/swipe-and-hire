import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import type { JobStageSettings } from '@/hooks/useJobStageSettings';
import type { JobApplication } from '@/hooks/useJobDetailsData';
import { JobStageSettingsMenu } from '@/components/JobStageSettingsMenu';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';
import { formatCompactTime } from '@/lib/date';
import { Star, Sparkles, ChevronRight, Plus, Square, CheckSquare, Check, X } from 'lucide-react';
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

/* ── Star Rating ─────────────────────────────────────── */
const StarRating = ({ rating = 0 }: { rating?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-2.5 w-2.5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`}
      />
    ))}
  </div>
);

/* ── Candidate Row ───────────────────────────────────── */
interface CandidateRowProps {
  app: JobApplication;
  onOpen: () => void;
  onMoveToStage: (appId: string, stage: string) => void;
  stages: string[];
  stageSettings: Record<string, { label: string; color: string; iconName: string; isCustom: boolean }>;
  criteriaCount: number;
  onMarkAsViewed?: (id: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const CandidateRow = memo(function CandidateRow({
  app,
  onOpen,
  onMoveToStage,
  stages,
  stageSettings,
  criteriaCount,
  onMarkAsViewed,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: CandidateRowProps) {
  const isUnread = !app.viewed_at;
  const appliedTime = formatCompactTime(app.applied_at);
  const criterionResults = app.criterionResults || [];
  const hasResults = criterionResults.length > 0;
  const needsEvaluation = criteriaCount > 0 && !hasResults;

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
    if (isUnread && onMarkAsViewed) onMarkAsViewed(app.id);
    onOpen();
  };

  const moveTargets = stages.filter(s => s !== app.status);

  return (
    <div
      ref={rowRef}
      className={`bg-white/5 ring-1 ring-inset rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] transition-all duration-150 min-h-touch relative
        ${isSelected ? 'ring-white/40 bg-white/[0.10]' : 'ring-white/10 active:scale-[0.98]'}
        ${isSelectionMode ? 'cursor-pointer' : ''}`}
      onClick={handleTap}
    >
      {/* Unread dot — top-left corner */}
      {!isSelectionMode && isUnread && (
        <div className="absolute left-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}

      {/* Avatar */}
      <div className="h-10 w-10 flex-shrink-0 [&>*:first-child]:h-10 [&>*:first-child]:w-10 [&_.h-10]:h-10 [&_.w-10]:w-10">
        <CandidateAvatar
          profileImageUrl={app.profile_image_url}
          videoUrl={app.video_url}
          isProfileVideo={app.is_profile_video}
          firstName={app.first_name}
          lastName={app.last_name}
          stopPropagation
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">
          {app.first_name} {app.last_name}
        </p>
        <StarRating rating={app.rating} />
        <div className="flex items-center gap-2 mt-0.5 text-white text-[11px]">
          {appliedTime && (
            <span>{appliedTime === 'nu' ? 'Ansökte idag' : `Ansökte för ${appliedTime} sedan`}</span>
          )}
          {/* AI results appear silently when ready — no "waiting" indicator */}
        </div>
        {/* Criterion badges */}
        {hasResults && (
          <div className="flex flex-wrap gap-1 mt-1">
            {criterionResults.map(cr => {
              const isMatch = cr.result === 'match';
              const isNoMatch = cr.result === 'no_match';
              return (
                <span
                  key={cr.criterion_id}
                  className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] ring-1 ring-inset ${
                    isMatch
                      ? 'bg-green-500/20 ring-green-500/30'
                      : isNoMatch
                      ? 'bg-red-500/20 ring-red-500/30'
                      : 'bg-yellow-500/20 ring-yellow-500/30'
                  }`}
                >
                  {isMatch ? (
                    <Check className={`h-2.5 w-2.5 flex-shrink-0 ${isMatch ? 'text-green-400' : ''}`} />
                  ) : (
                    <X className={`h-2.5 w-2.5 flex-shrink-0 ${isNoMatch ? 'text-red-400' : 'text-yellow-400'}`} />
                  )}
                  <span className="text-white/80 truncate max-w-[50px]">{cr.title}</span>
                </span>
              );
            })}
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
              const cfg = stageSettings[stage];
              if (!cfg) return null;
              const Icon = getJobStageIconByName(cfg.iconName);
              return (
                <TooltipProvider key={stage} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem
                        onClick={e => {
                          e.stopPropagation();
                          onMoveToStage(app.id, stage);
                        }}
                        className="gap-2 min-h-[44px] min-w-0"
                      >
                        <Icon className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
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

/* ── Main Mobile Candidate View ──────────────────────── */
interface MobileCandidateViewProps {
  jobId: string;
  applications: JobApplication[];
  stages: string[];
  stageSettings: Record<string, { label: string; color: string; iconName: string; isCustom: boolean }>;
  criteriaCount: number;
  onOpenProfile: (app: JobApplication) => void;
  onMoveToStage: (appId: string, stage: string) => void;
  onMarkAsViewed: (id: string) => void;
  onOpenCriteriaDialog?: () => void;
  isSelectionMode?: boolean;
  selectedApplicationIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  renderActionBar?: React.ReactNode;
}

export const MobileCandidateView = memo(function MobileCandidateView({
  jobId,
  applications,
  stages,
  stageSettings,
  criteriaCount,
  onOpenProfile,
  onMoveToStage,
  onMarkAsViewed,
  onOpenCriteriaDialog,
  isSelectionMode,
  selectedApplicationIds,
  onToggleSelect,
  renderActionBar,
}: MobileCandidateViewProps) {
  const [activeTab, setActiveTab] = useState(stages[0] || 'pending');
  const [openStageMenu, setOpenStageMenu] = useState<string | null>(null);
  const lastTouchTapRef = useRef<{ stage: string; time: number } | null>(null);
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  const isTouchCapable = useTouchCapable();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollIndicator, setScrollIndicator] = useState<number>(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleStagePointerDown = useCallback((stage: string, pointerType: string) => {
    if (pointerType === 'mouse') return;
    setActiveTab(stage);
    setOpenStageMenu((prev) => (prev && prev !== stage ? null : prev));

    const now = Date.now();
    const lastTap = lastTouchTapRef.current;
    const isDoubleTap = !!lastTap && lastTap.stage === stage && now - lastTap.time <= 320;

    if (isDoubleTap) {
      setOpenStageMenu(stage);
      lastTouchTapRef.current = null;
      return;
    }

    lastTouchTapRef.current = { stage, time: now };
  }, []);

  const appsByStage = useMemo(() => {
    const result: Record<string, JobApplication[]> = {};
    stages.forEach(s => (result[s] = []));
    applications.forEach(app => {
      if (result[app.status]) {
        result[app.status].push(app);
      } else {
        // Orphaned candidate (stage deleted) — put in first active stage
        const firstStage = stages[0];
        if (firstStage) result[firstStage].push(app);
      }
    });
    return result;
  }, [applications, stages]);

  const currentApps = appsByStage[activeTab] || [];

  // Reset indicator when tab changes
  useEffect(() => {
    setScrollIndicator(0);
    setShowIndicator(false);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [activeTab]);

  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const cardHeight = 88; // approximate card height + gap
    const scrolled = Math.floor(el.scrollTop / cardHeight);
    const visible = Math.min(scrolled + 1, currentApps.length);
    setScrollIndicator(visible);
    setShowIndicator(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowIndicator(false), 2000);
  }, [currentApps.length]);

  return (
    <div className="flex flex-col gap-3">
      {/* Horizontal scrollable stage tabs — native momentum on touch, drag on desktop */}
      <div
        ref={dragScrollRef}
        className={`flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 overscroll-x-contain ${
          isTouchCapable
            ? '[touch-action:pan-x] [-webkit-overflow-scrolling:touch]'
            : 'cursor-grab active:cursor-grabbing select-none'
        }`}
      >
        {stages.map((stage, stageIdx) => {
          const cfg = stageSettings[stage];
          if (!cfg) return null;
          const Icon = getJobStageIconByName(cfg.iconName);
          const count = (appsByStage[stage] || []).length;
          const isActive = stage === activeTab;

          const targetIdx = stageIdx === 0 ? 1 : 0;
          const targetStageKey = stages[targetIdx];
          const targetStageLabel = stageSettings[targetStageKey]?.label;

          return (
            <div
              key={stage}
               data-stage-tab
               tabIndex={0}
               onPointerDownCapture={(e) => handleStagePointerDown(stage, e.pointerType)}
               onClick={() => setActiveTab(stage)}
               onDoubleClick={() => setOpenStageMenu(stage)}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(stage); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 backdrop-blur-sm cursor-pointer max-w-[180px] border outline-none focus:outline-none focus-visible:outline-none [outline:none!important] ${
                isActive ? 'shadow-lg border-white/50' : 'border-transparent'
              }`}
              style={{ backgroundColor: `${cfg.color}55` }}
            >
              <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
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
                className="text-[10px] leading-none h-[18px] w-[18px] flex items-center justify-center rounded-full text-white flex-shrink-0 text-center"
                style={{ backgroundColor: `${cfg.color}88` }}
              >
                {count}
              </span>
              {/* Stage settings menu (3-dot) — visual-only on touch, functional on mouse */}
              <span
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <JobStageSettingsMenu
                  jobId={jobId}
                  stageKey={stage}
                  candidateCount={count}
                  totalStageCount={stages.length}
                  targetStageKey={targetStageKey}
                  targetStageLabel={targetStageLabel}
                  stageIndex={stageIdx}
                  disableTouchTrigger={isTouchCapable}
                  open={openStageMenu === stage}
                  onOpenChange={(nextOpen) => {
                    setOpenStageMenu((prev) => {
                      if (nextOpen) return stage;
                      return prev === stage ? null : prev;
                    });
                  }}
                />
              </span>
            </div>
          );
        })}

        {/* Add new stage button */}
        {stages.length < 8 && (
          <CreateJobStageDialog
            jobId={jobId}
            currentStageCount={stages.length}
            trigger={
              <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap bg-white/5 text-white ring-1 ring-inset ring-white/10 active:scale-95 transition-all shrink-0 backdrop-blur-sm">
                <Plus className="h-3.5 w-3.5" />
                Nytt steg
              </button>
            }
          />
        )}
      </div>

      {/* AI Urvalskriterier button — visible when on first tab */}
      {activeTab === stages[0] && onOpenCriteriaDialog && (
        <button
          onClick={onOpenCriteriaDialog}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-white/5 ring-1 ring-inset ring-white/10 active:scale-[0.97] transition-all backdrop-blur-sm w-full justify-center min-h-touch"
        >
          <Sparkles className="h-4 w-4 text-white" />
          Urvalskriterier
          {criteriaCount > 0 && (
            <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded-full">
              {criteriaCount} aktiva
            </span>
          )}
        </button>
      )}

      {/* Inline action bar for selection mode — placed above candidate list */}
      {renderActionBar}

      {/* Candidate list — internally scrollable so action bar stays visible */}
      <div className="relative">
        {/* Scroll position indicator — fades in on scroll, fades out after 2s */}
        {currentApps.length > 6 && (
          <div
            className={`absolute top-2 right-2 z-10 pointer-events-none transition-opacity duration-300 ${
              showIndicator ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10">
              {scrollIndicator}/{currentApps.length}
            </span>
          </div>
        )}
        <ScrollArea className="overscroll-contain" style={{ maxHeight: 'calc(100dvh - 340px)' }}>
          <div
            ref={listRef}
            onScroll={handleListScroll}
            className="flex flex-col gap-2"
          >
            {currentApps.length === 0 ? (
              <div className="text-center py-12 text-sm text-white">
                Inga kandidater i detta steg
              </div>
            ) : (
              currentApps.map((app, idx) => (
                <CandidateRow
                  key={app.id}
                  app={app}
                  onOpen={() => onOpenProfile(app)}
                  onMoveToStage={onMoveToStage}
                  stages={stages}
                  stageSettings={stageSettings}
                  criteriaCount={criteriaCount}
                  onMarkAsViewed={onMarkAsViewed}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedApplicationIds?.has(app.id)}
                  onToggleSelect={() => onToggleSelect?.(app.id)}
                />
              ))
            )}
            {isSelectionMode && currentApps.length > 0 && <div className="h-2" />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
