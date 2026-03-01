import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedText } from '@/components/TruncatedText';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { getIconByName, type CandidateStage } from '@/hooks/useStageSettings';
import { StageSettingsMenu } from '@/components/StageSettingsMenu';
import { CreateStageDialog } from '@/components/CreateStageDialog';
import { formatCompactTime } from '@/lib/date';
import { Star, ChevronRight, Plus, Check, X } from 'lucide-react';
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
        className={`h-2.5 w-2.5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`}
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
}: CandidateRowProps) {
  const isUnread = !candidate.viewed_at;
  const appliedTime = formatCompactTime(candidate.applied_at);

  const handleTap = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
      return;
    }
    onOpen();
  };

  const moveTargets = stages.filter(s => s !== candidate.stage);

  return (
    <div
      className={`bg-white/5 ring-1 ring-inset rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] transition-all duration-150 min-h-touch relative
        ${isSelected ? 'ring-white/40 bg-white/[0.10]' : 'ring-white/10 active:bg-white/[0.08]'}
        ${isSelectionMode ? 'cursor-pointer' : ''}`}
      onClick={handleTap}
    >
      {/* Unread dot */}
      {!isSelectionMode && isUnread && (
        <div className="absolute left-1.5 top-1.5">
          <div className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
        </div>
      )}

      {/* Avatar */}
      <div className="h-10 w-10 flex-shrink-0 [&>*:first-child]:h-10 [&>*:first-child]:w-10">
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
        <div className="flex items-center gap-2 mt-0.5">
          {candidate.job_title && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-white text-[11px] truncate max-w-[120px] cursor-default">
                  {candidate.job_title}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px]">
                <p className="text-sm break-words">{candidate.job_title}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {appliedTime && (
          <span className="text-white text-[11px] mt-0.5 block">
            {appliedTime === 'nu' ? 'Ansökte idag' : `Ansökte för ${appliedTime} sedan`}
          </span>
        )}
      </div>

      {/* Right side */}
      {isSelectionMode ? (
        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.()}
            className="h-3.5 w-3.5 border border-white/50 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-white"
          />
        </div>
      ) : (
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
}: MobileMyCandidatesViewProps) {
  const [activeTab, setActiveTab] = useState(stages[0] || 'to_contact');
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollIndicator, setScrollIndicator] = useState<number>(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

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

  // Reset indicator when tab changes
  useEffect(() => {
    setScrollIndicator(0);
    setShowIndicator(false);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [activeTab]);

  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const cardHeight = 88;
    const scrolled = Math.floor(el.scrollTop / cardHeight);
    const visible = Math.min(scrolled + 1, currentCandidates.length);
    setScrollIndicator(visible);
    setShowIndicator(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowIndicator(false), 2000);
  }, [currentCandidates.length]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3">
        {/* Horizontal scrollable stage tabs */}
        <div
          ref={dragScrollRef}
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
                onClick={() => setActiveTab(stage)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(stage); } }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 ring-1 ring-inset backdrop-blur-sm cursor-pointer max-w-[160px] ${
                  isActive
                    ? 'ring-white/40 shadow-lg'
                    : 'ring-white/20'
                }`}
                style={{ backgroundColor: `${cfg.color}55` }}
              >
                <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
                <TruncatedText
                  text={cfg.label}
                  className="truncate min-w-0 text-xs font-medium text-white"
                  tooltipSide="bottom"
                />
                <span
                  className="text-[10px] h-5 w-5 flex items-center justify-center rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: `${cfg.color}88` }}
                >
                  {count}
                </span>
                {/* Stage settings menu (3-dot) */}
                {!isReadOnly && (
                  <span onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                    <StageSettingsMenu
                      stageKey={stage}
                      candidateCount={count}
                      totalStageCount={stages.length}
                      targetStageKey={targetStageKey}
                      targetStageLabel={targetStageLabel}
                      onMoveCandidatesAndDelete={onMoveCandidatesAndDelete}
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

        {/* Candidate list — internally scrollable */}
        <div className="relative">
          {currentCandidates.length > 6 && (
            <div
              className={`absolute top-2 right-2 z-10 pointer-events-none transition-opacity duration-300 ${
                showIndicator ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10">
                {scrollIndicator}/{currentCandidates.length}
              </span>
            </div>
          )}
          <ScrollArea className="overscroll-contain" style={{ maxHeight: 'calc(100dvh - 340px)' }}>
            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="flex flex-col gap-2"
            >
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
                  />
                ))
              )}
              {isSelectionMode && currentCandidates.length > 0 && <div className="h-2" />}
            </div>
          </ScrollArea>
        </div>

        {/* Inline action bar for selection mode */}
        {renderActionBar}
      </div>
    </TooltipProvider>
  );
});
