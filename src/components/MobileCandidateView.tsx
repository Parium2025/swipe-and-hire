import { memo, useState, useMemo, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import type { JobStageSettings } from '@/hooks/useJobStageSettings';
import type { JobApplication } from '@/hooks/useJobDetailsData';
import { JobStageSettingsMenu } from '@/components/JobStageSettingsMenu';
import { CreateJobStageDialog } from '@/components/CreateJobStageDialog';
import { formatCompactTime } from '@/lib/date';
import { Star, ArrowDown, Sparkles, ChevronRight, Plus } from 'lucide-react';
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
}

const CandidateRow = memo(function CandidateRow({
  app,
  onOpen,
  onMoveToStage,
  stages,
  stageSettings,
  criteriaCount,
  onMarkAsViewed,
}: CandidateRowProps) {
  const isUnread = !app.viewed_at;
  const appliedTime = formatCompactTime(app.applied_at);
  const criterionResults = app.criterionResults || [];
  const hasResults = criterionResults.length > 0;
  const needsEvaluation = criteriaCount > 0 && !hasResults;

  const handleTap = () => {
    if (isUnread && onMarkAsViewed) onMarkAsViewed(app.id);
    onOpen();
  };

  const moveTargets = stages.filter(s => s !== app.status);

  return (
    <div
      className="bg-white/5 ring-1 ring-inset ring-white/10 rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] active:bg-white/[0.08] transition-all duration-150 min-h-touch relative"
      onClick={handleTap}
    >
      {/* Unread dot */}
      {isUnread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2">
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
        <div className="flex items-center gap-2 mt-0.5 text-white/60 text-[11px]">
          {appliedTime && (
            <span className="flex items-center gap-0.5">
              <ArrowDown className="h-2.5 w-2.5" />
              {appliedTime}
            </span>
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

      {/* Move stage dropdown */}
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
    </div>
  );
});

/* ── Drag-scrollable container hook ──────────────────── */
function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.clientX;
    scrollLeft.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !ref.current) return;
    const dx = e.clientX - startX.current;
    ref.current.scrollLeft = scrollLeft.current - dx;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    ref.current?.releasePointerCapture(e.pointerId);
  }, []);

  return { ref, onPointerDown, onPointerMove, onPointerUp };
}

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
}: MobileCandidateViewProps) {
  const [activeTab, setActiveTab] = useState(stages[0] || 'pending');
  const dragScroll = useDragScroll();

  const appsByStage = useMemo(() => {
    const result: Record<string, JobApplication[]> = {};
    stages.forEach(s => (result[s] = []));
    applications.forEach(app => {
      if (result[app.status]) result[app.status].push(app);
    });
    return result;
  }, [applications, stages]);

  const currentApps = appsByStage[activeTab] || [];

  return (
    <div className="flex flex-col gap-3">
      {/* Horizontal scrollable stage tabs with drag-scroll */}
      <div
        ref={dragScroll.ref}
        onPointerDown={dragScroll.onPointerDown}
        onPointerMove={dragScroll.onPointerMove}
        onPointerUp={dragScroll.onPointerUp}
        className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 cursor-grab active:cursor-grabbing select-none"
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
            <button
              key={stage}
              onClick={() => setActiveTab(stage)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-95 min-h-touch shrink-0 ring-1 ring-inset backdrop-blur-sm ${
                isActive
                  ? 'ring-white/30'
                  : 'ring-white/10'
              }`}
              style={{ backgroundColor: isActive ? `${cfg.color}33` : 'rgba(255,255,255,0.05)' }}
            >
              <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
              {cfg.label}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: `${cfg.color}66` }}
              >
                {count}
              </span>
              {/* Stage settings menu (3-dot) */}
              <span onClick={e => e.stopPropagation()}>
                <JobStageSettingsMenu
                  jobId={jobId}
                  stageKey={stage}
                  candidateCount={count}
                  totalStageCount={stages.length}
                  targetStageKey={targetStageKey}
                  targetStageLabel={targetStageLabel}
                />
              </span>
            </button>
          );
        })}

        {/* Add new stage button */}
        {stages.length < 5 && (
          <CreateJobStageDialog
            jobId={jobId}
            currentStageCount={stages.length}
            trigger={
              <button className="flex items-center gap-1 px-2.5 py-2 rounded-md text-xs font-medium whitespace-nowrap bg-white/5 text-white/50 ring-1 ring-inset ring-white/10 active:scale-95 transition-all min-h-touch shrink-0 backdrop-blur-sm">
                <Plus className="h-3.5 w-3.5" />
                Nytt steg
              </button>
            }
          />
        )}
      </div>

      {/* Candidate list */}
      <div className="flex flex-col gap-2 relative">
        {currentApps.length === 0 ? (
          <div className="text-center py-12 text-sm text-white">
            Inga kandidater i detta steg
          </div>
        ) : (
          currentApps.map(app => (
            <CandidateRow
              key={app.id}
              app={app}
              onOpen={() => onOpenProfile(app)}
              onMoveToStage={onMoveToStage}
              stages={stages}
              stageSettings={stageSettings}
              criteriaCount={criteriaCount}
              onMarkAsViewed={onMarkAsViewed}
            />
          ))
        )}
      </div>
    </div>
  );
});
