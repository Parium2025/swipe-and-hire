import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import type { JobStageSettings } from '@/hooks/useJobStageSettings';
import type { JobApplication } from '@/hooks/useJobDetailsData';
import { JobStageSettingsMenu } from '@/components/JobStageSettingsMenu';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';
import { formatCompactTime } from '@/lib/date';
import { Star, Sparkles, ChevronRight, Plus, Square, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDragScroll } from '@/hooks/useDragScroll';
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
      className={`bg-white/5 ring-1 ring-inset rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] transition-all duration-150 min-h-touch relative
        ${isSelected ? 'ring-white/40 bg-white/[0.10]' : 'ring-white/10 active:bg-white/[0.08]'}
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
          {needsEvaluation && (
            <span className="flex items-center gap-0.5 text-white/40">
              <Sparkles className="h-2.5 w-2.5" />
              Väntar på AI
            </span>
          )}
        </div>
        {/* Criterion badges */}
        {hasResults && (
          <div className="flex flex-wrap gap-1 mt-1">
            {criterionResults.map(cr => (
              <span
                key={cr.criterion_id}
                className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  cr.result === 'match'
                    ? 'bg-green-500/20 text-green-300'
                    : cr.result === 'no_match'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-white/10 text-white/50'
                }`}
              >
                {cr.title}
              </span>
            ))}
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
              const cfg = stageSettings[stage];
              if (!cfg) return null;
              const Icon = getJobStageIconByName(cfg.iconName);
              return (
                <DropdownMenuItem
                  key={stage}
                  onClick={e => {
                    e.stopPropagation();
                    onMoveToStage(app.id, stage);
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
  const dragScrollRef = useDragScroll<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollIndicator, setScrollIndicator] = useState<number>(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const appsByStage = useMemo(() => {
    const result: Record<string, JobApplication[]> = {};
    stages.forEach(s => (result[s] = []));
    applications.forEach(app => {
      if (result[app.status]) result[app.status].push(app);
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
        className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 touch-pan-x cursor-grab active:cursor-grabbing select-none [touch-action:pan-x] [-webkit-overflow-scrolling:touch] overscroll-x-contain"
      >
        {stages.map(stage => {
          const cfg = stageSettings[stage];
          if (!cfg) return null;
          const Icon = getJobStageIconByName(cfg.iconName);
          const count = (appsByStage[stage] || []).length;
          const isActive = stage === activeTab;

          // Find target stage for delete (next or first)
          const stageIdx = stages.indexOf(stage);
          const targetIdx = stageIdx === 0 ? 1 : 0;
          const targetStageKey = stages[targetIdx];
          const targetStageLabel = stageSettings[targetStageKey]?.label;

          return (
            <div
              key={stage}
              data-stage-tab
              tabIndex={0}
              onClick={() => setActiveTab(stage)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(stage); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 ring-1 ring-inset backdrop-blur-sm cursor-pointer ${
                isActive
                  ? 'ring-white/40 shadow-lg'
                  : 'ring-white/20'
              }`}
              style={{ backgroundColor: `${cfg.color}55` }}
            >
              <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
              {cfg.label}
              <span
                className="text-[10px] h-5 w-5 flex items-center justify-center rounded-full text-white"
                style={{ backgroundColor: `${cfg.color}88` }}
              >
                {count}
              </span>
              {/* Stage settings menu (3-dot) */}
              <span onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                <JobStageSettingsMenu
                  jobId={jobId}
                  stageKey={stage}
                  candidateCount={count}
                  totalStageCount={stages.length}
                  targetStageKey={targetStageKey}
                  targetStageLabel={targetStageLabel}
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

      {/* AI Urvalskriterier button — visible when on Inkorg tab */}
      {activeTab === 'pending' && onOpenCriteriaDialog && (
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

      {/* Inline action bar for selection mode */}
      {renderActionBar}
    </div>
  );
});
