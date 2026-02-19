import { memo, useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { getJobStageIconByName } from '@/hooks/useJobStageSettings';
import type { JobStageSettings } from '@/hooks/useJobStageSettings';
import type { JobApplication } from '@/hooks/useJobDetailsData';
import { formatCompactTime } from '@/lib/date';
import { Star, ArrowDown, Clock, Sparkles, ChevronRight } from 'lucide-react';
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

  // Available stages to move to (exclude current)
  const moveTargets = stages.filter(s => s !== app.status);

  return (
    <div
      className="bg-white/5 ring-1 ring-inset ring-white/10 rounded-lg px-3 py-2.5 flex items-center gap-3 active:scale-[0.98] active:bg-white/[0.08] transition-all duration-150 min-h-touch"
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

/* ── Main Mobile Candidate View ──────────────────────── */
interface MobileCandidateViewProps {
  applications: JobApplication[];
  stages: string[];
  stageSettings: Record<string, { label: string; color: string; iconName: string; isCustom: boolean }>;
  criteriaCount: number;
  onOpenProfile: (app: JobApplication) => void;
  onMoveToStage: (appId: string, stage: string) => void;
  onMarkAsViewed: (id: string) => void;
}

export const MobileCandidateView = memo(function MobileCandidateView({
  applications,
  stages,
  stageSettings,
  criteriaCount,
  onOpenProfile,
  onMoveToStage,
  onMarkAsViewed,
}: MobileCandidateViewProps) {
  const [activeTab, setActiveTab] = useState(stages[0] || 'pending');

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
      {/* Horizontal scrollable stage tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {stages.map(stage => {
          const cfg = stageSettings[stage];
          if (!cfg) return null;
          const Icon = getJobStageIconByName(cfg.iconName);
          const count = (appsByStage[stage] || []).length;
          const isActive = stage === activeTab;

          return (
            <button
              key={stage}
              onClick={() => setActiveTab(stage)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-95 min-h-touch ${
                isActive
                  ? 'bg-white/15 text-white ring-1 ring-inset ring-white/30'
                  : 'bg-white/5 text-white/60 ring-1 ring-inset ring-white/10'
              }`}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: isActive ? cfg.color : undefined }} />
              {cfg.label}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: isActive ? `${cfg.color}33` : 'rgba(255,255,255,0.1)',
                  color: isActive ? cfg.color : undefined,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
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
