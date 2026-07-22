/**
 * Skeleton for JobDetails — mirrors the real JobDetailsHeader + empty kanban state.
 * It uses route/card hints when available so the title wraps like the actual ad.
 */
import { CheckSquare, Eye, MapPin, Plus, QrCode, Users, X } from 'lucide-react';

const SHAPE = 'bg-white/10 animate-pulse';

export interface JobDetailsSkeletonHint {
  title?: string | null;
  location?: string | null;
  expiresAt?: string | null;
  viewsCount?: number | null;
  applicationsCount?: number | null;
  recruiterName?: string | null;
  isActive?: boolean | null;
}

const DEFAULT_STAGES = [
  { label: 'Inkorg', color: '#EAB308', iconWidth: 'w-3.5' },
  { label: 'Granskar', color: '#3B82F6', iconWidth: 'w-3.5' },
  { label: 'Intervju', color: '#8B5CF6', iconWidth: 'w-3.5' },
  { label: 'Erbjuden', color: '#22C55E', iconWidth: 'w-3.5' },
  { label: 'Anställd', color: '#10B981', iconWidth: 'w-3.5' },
];

const formatExpiry = (expiresAt?: string | null) => {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date < new Date()
    ? `Gick ut ${date.toLocaleDateString('sv-SE')}`
    : `Går ut ${date.toLocaleDateString('sv-SE')}`;
};

const writeSafeNumber = (value?: number | null) => (typeof value === 'number' ? value : 0);

export const JobDetailsSkeleton = ({ hint }: { hint?: JobDetailsSkeletonHint }) => {
  const title = hint?.title?.trim();
  const location = hint?.location?.trim();
  const expiryText = formatExpiry(hint?.expiresAt);
  const recruiterName = hint?.recruiterName?.trim();

  return (
    <div className="space-y-3 md:space-y-4 w-full px-2 md:px-0 py-3 md:py-4 pb-safe min-h-screen animate-fade-in md:max-w-[clamp(20rem,82vw,76rem)] md:mx-auto md:px-[clamp(0.75rem,2.5vw,2rem)]">
      {/* Header card — same layout as JobDetailsHeader */}
      <div className="relative z-30 rounded-lg border border-white/20 bg-white/5 p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          {title ? (
            <h1 className="text-lg font-bold text-white flex-1 min-w-0 line-clamp-2 animate-pulse">
              {title}
            </h1>
          ) : (
            <div className="flex-1 min-w-0 space-y-2">
              <div className={`h-5 w-3/4 rounded ${SHAPE}`} />
              <div className={`h-5 w-1/2 rounded ${SHAPE}`} />
            </div>
          )}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 animate-pulse">
            <X className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm animate-pulse">
          {hint?.isActive === false ? (
            <span className="inline-flex h-5 items-center rounded-full bg-white/10 px-2 text-[11px] font-medium text-white">Utgången</span>
          ) : (
            <span className="inline-flex h-5 items-center rounded-full bg-green-500/70 px-2 text-[11px] font-medium text-white">Aktiv</span>
          )}

          <div className="flex items-center gap-1 text-white min-w-0">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            {location ? (
              <span className="truncate">{location}</span>
            ) : (
              <span className={`h-4 w-24 rounded ${SHAPE}`} />
            )}
          </div>

          {expiryText ? (
            <span className="text-white text-xs">{expiryText}</span>
          ) : (
            <span className={`h-4 w-32 rounded ${SHAPE}`} />
          )}
        </div>

        <div className="mt-3 space-y-1.5 md:space-y-0">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 min-w-0">
            <div className="flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 animate-pulse">
              <Eye className="h-3.5 w-3.5 text-white flex-shrink-0" />
              <span className="text-white text-xs font-medium truncate">{writeSafeNumber(hint?.viewsCount)}</span>
              <span className="text-white text-xs truncate">Visn.</span>
            </div>

            <div className="flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 animate-pulse">
              <Users className="h-3.5 w-3.5 text-white flex-shrink-0" />
              <span className="text-white text-xs font-medium truncate">{writeSafeNumber(hint?.applicationsCount)}</span>
              <span className="text-white text-xs truncate">Ans.</span>
            </div>

            <div className="flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 animate-pulse">
              <div className="h-5 w-5 rounded-full bg-white/10 flex-shrink-0" />
              {recruiterName ? (
                <span className="text-white text-xs truncate max-w-[60px]">{recruiterName}</span>
              ) : (
                <span className="h-3 w-12 rounded bg-white/10" />
              )}
            </div>

            <div className="hidden md:flex rounded-lg px-2 py-1.5 items-center justify-center gap-1 min-w-0 overflow-hidden border border-white/20 bg-white/5 opacity-40 animate-pulse">
              <CheckSquare className="h-3.5 w-3.5 text-white flex-shrink-0" />
              <span className="text-white text-xs font-medium">Välj</span>
            </div>

            <div className="hidden md:flex rounded-lg px-2 py-1.5 items-center justify-center gap-1 min-w-0 overflow-hidden border border-white/20 bg-white/5 animate-pulse">
              <Eye className="h-3.5 w-3.5 text-white flex-shrink-0" />
              <span className="text-white text-xs font-medium">Visa</span>
            </div>

            <div className="hidden md:flex min-w-0 rounded-lg px-2 py-1.5 items-center justify-center gap-1 border border-white/20 bg-white/5 animate-pulse">
              <QrCode className="h-3.5 w-3.5 text-white flex-shrink-0" />
              <span className="text-white text-xs font-medium">QR</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 min-w-0 md:hidden">
            <div className="rounded-lg px-3 py-2.5 flex items-center justify-center gap-1.5 ring-1 min-w-0 overflow-hidden bg-white/[0.04] ring-white/20 opacity-40 animate-pulse">
              <CheckSquare className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-white text-sm font-medium">Välj</span>
            </div>
            <div className="rounded-lg px-3 py-2.5 flex items-center justify-center gap-1.5 ring-1 min-w-0 overflow-hidden bg-white/[0.045] ring-white/30 animate-pulse">
              <Eye className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-white text-sm font-medium">Visa</span>
            </div>
            <div className="rounded-lg px-3 py-2.5 flex items-center justify-center gap-1.5 ring-1 min-w-0 overflow-hidden bg-white/[0.045] ring-white/30 animate-pulse">
              <QrCode className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-white text-sm font-medium">QR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop kanban — full empty columns, not floating bars */}
      <div
        className="hidden md:flex gap-3 pb-4 pt-2 overflow-hidden select-none"
        style={{ height: 'calc(100vh - 300px)', overflowY: 'hidden' }}
      >
        {DEFAULT_STAGES.map((stage) => (
          <div
            key={stage.label}
            className="flex-shrink-0 flex flex-col h-full"
            style={{ width: 'clamp(200px, 22vw, 260px)', minWidth: '180px' }}
          >
            <div
              className="group rounded-md px-2 py-1.5 mb-2 transition-all ring-1 ring-inset ring-foreground/20 flex-shrink-0 animate-pulse"
              style={{ backgroundColor: `${stage.color}55` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`h-3.5 ${stage.iconWidth} rounded bg-white/50 flex-shrink-0`} />
                <span className="font-medium text-xs text-white truncate flex-1 min-w-0">{stage.label}</span>
                <span
                  className="text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `${stage.color}88` }}
                >
                  0
                </span>
                <div className="ml-auto flex h-5 w-5 items-center justify-center rounded text-white/80">
                  <span className="h-1 w-1 rounded-full bg-white/70" />
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 rounded-lg border border-white/20 bg-white/5 animate-pulse">
              <div className="h-full overflow-y-hidden space-y-1.5 p-2">
                <div className="py-8 text-center text-xs text-white">
                  Inga kandidater i detta steg
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="flex-shrink-0 flex items-start pt-1">
          <div className="flex h-7 items-center gap-1 rounded-md bg-white/5 px-2.5 text-xs font-medium text-white ring-1 ring-inset ring-white/10 animate-pulse">
            <Plus className="h-3.5 w-3.5" />
            Nytt steg
          </div>
        </div>
      </div>

      {/* Mobile candidate view — real tab row + real empty list footprint */}
      <div className="md:hidden flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex gap-1.5 overflow-hidden pb-1 -mx-1 px-1">
          {DEFAULT_STAGES.slice(0, 4).map((stage) => (
            <div
              key={stage.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap shrink-0 max-w-[180px] border border-transparent animate-pulse"
              style={{ backgroundColor: `${stage.color}55` }}
            >
              <div className={`h-3.5 ${stage.iconWidth} rounded bg-white/50 flex-shrink-0`} />
              <span className="truncate min-w-0">{stage.label}</span>
              <span
                className="text-[10px] leading-none h-[18px] w-[18px] flex items-center justify-center rounded-full text-white flex-shrink-0 text-center"
                style={{ backgroundColor: `${stage.color}88` }}
              >
                0
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap bg-white/5 text-white ring-1 ring-inset ring-white/10 shrink-0 animate-pulse">
            <Plus className="h-3.5 w-3.5" />
            Nytt steg
          </div>
        </div>

        <div className="relative flex-1 min-h-[40vh] rounded-lg border border-white/20 bg-white/5 animate-pulse">
          <div className="text-center py-12 text-sm text-white min-h-[40vh] flex items-center justify-center">
            Inga kandidater i detta steg
          </div>
        </div>
      </div>
    </div>
  );
};
