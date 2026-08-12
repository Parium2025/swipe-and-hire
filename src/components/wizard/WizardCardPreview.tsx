import { memo, useMemo, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  Bookmark,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  Eye,
  FileQuestion,
  Gift,
  Heart,
  Users,
  X,
} from 'lucide-react';

import { TruncatedText } from '@/components/TruncatedText';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DEFAULT_JOB_OVERLAY_TEXT_COLOR,
  getJobOverlayTextStyle,
  normalizeJobOverlayTextColor,
} from '@/lib/jobOverlayText';
import { formatDateShortSv } from '@/lib/date';



/**
 * Delade förhandsvisningar för wizarden (Skapa/Redigera jobb).
 *
 *  - WizardSwipePreview  → matchar riktiga swipe mode-kortet (bild 1)
 *  - WizardListPreview   → matchar riktiga listkortet (bild 3, /jobb-sök-resultat)
 *
 * Båda är rent visuella (inga hooks, ingen navigation) och tar all data
 * som props så att de aldrig krockar med wizarderns state.
 */

export interface WizardPreviewData {
  title: string;
  companyName: string;
  companyLogoUrl?: string | null;
  imageUrl?: string | null;
  imageFocusPosition?: string;
  occupation?: string | null;
  metaLine?: string;
  employmentTypeLabel?: string;
  workingHours?: string | null;
  location?: string;
  salaryText?: string | null;
  benefitsCount?: number;
  applicationsCount?: number;
  daysLeftLabel?: string;
  overlayTextColor?: string | null;
  recruiterName?: string | null;
  publishedLabel?: string | null;
  startDateLabel?: string | null;
  questionsCount?: number;
  viewsCount?: number;
  isExpired?: boolean;
  isActive?: boolean;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    const w = words[0];
    return (w[0] + (w[w.length - 1] || '')).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getObjectPosition(v?: string): string {
  if (!v || v === 'center') return 'center 50%';
  if (v === 'top') return 'center 20%';
  if (v === 'bottom') return 'center 80%';
  return `center ${v}%`;
}

/* -----------------------------------------------------------------------
 * Swipe preview — inuti telefon-mockupen (Steg 4 → Mobilvy)
 * ---------------------------------------------------------------------*/

interface WizardSwipePreviewProps extends WizardPreviewData {
  onOpenForm?: (e: MouseEvent) => void;
  onOpenCompany?: (e: MouseEvent) => void;
}

export const WizardSwipePreview = memo(function WizardSwipePreview({
  title,
  companyName,
  companyLogoUrl,
  imageUrl,
  imageFocusPosition,
  occupation,
  metaLine,
  workingHours,
  employmentTypeLabel,
  salaryText,
  benefitsCount = 0,
  applicationsCount = 0,
  publishedLabel,
  startDateLabel,
  questionsCount = 0,
  overlayTextColor,
  onOpenForm,
  onOpenCompany,
}: WizardSwipePreviewProps) {
  const overlayStyle: CSSProperties = useMemo(
    () => getJobOverlayTextStyle(overlayTextColor),
    [overlayTextColor],
  );
  const initials = useMemo(() => getInitials(companyName || 'Företag'), [companyName]);

  return (
    <TooltipProvider delayDuration={150}>
    <div
      className="absolute inset-0 z-10 select-none"
      onClick={onOpenForm}
    >
      {/* Bakgrundsbild */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: getObjectPosition(imageFocusPosition) }}
          draggable={false}
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-indigo-900/50 to-slate-900/70" />
      )}
      {/* Läsbarhetsgradient nertill */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />


      {/* Centrerat överlägg */}
      <div
        className="absolute inset-x-0 top-[18%] bottom-[26%] z-[2] flex items-center justify-center px-2 text-center"
        style={overlayStyle}
      >
        <div className="w-full max-w-[95%]">
          {/* Logga */}
          <div className="flex justify-center mb-1">
            {companyLogoUrl ? (
              <div className="w-7 h-7 rounded-full bg-[hsl(215,85%,15%)] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white/70 tracking-wide">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Företagspill */}
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCompany?.(e);
                  }}
                  className="inline-flex max-w-[90%] items-center gap-1 px-1.5 py-[2px] rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                >
                  <Building2 className="h-2 w-2 shrink-0 text-white" />
                  <span className="text-[8px] font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                    {companyName || 'Företag'}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {companyName || 'Företag'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Titel — luft ovanför så företagspillen får andas, tillåter 2 rader */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default mt-2">
                <TruncatedText
                  text={title || 'Jobbtitel'}
                  className="w-full text-[12px] font-extrabold leading-[1.15] tracking-tight line-clamp-2 break-words"
                  style={overlayStyle}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-[280px] text-center">
              {title || 'Jobbtitel'}
            </TooltipContent>
          </Tooltip>

          {/* Meta */}
          {metaLine && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className="mt-1.5 text-[8px] font-semibold truncate cursor-default"
                  style={overlayStyle}
                >
                  {metaLine}
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-[280px] text-center">
                {metaLine}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Badge-rad — i samma ordning som swipe mode, staplade vertikalt */}
          <div className="flex flex-col items-center justify-center gap-2 mt-3">
            {workingHours && (
              <PreviewPill
                icon={<Clock className="h-2 w-2 text-white" />}
                text={workingHours}
              />
            )}
            {startDateLabel && (
              <PreviewPill
                icon={<CalendarDays className="h-2 w-2 text-white" />}
                text={`Start ${startDateLabel}`}
              />
            )}
            {salaryText && <PreviewPill text={salaryText} />}
            {benefitsCount > 0 && (
              <PreviewPill
                text={`Förmåner ${benefitsCount <= 5 ? `${benefitsCount} st` : `${Math.floor(benefitsCount / 5) * 5}+`}`}
              />
            )}
            {/* Frågor visas inte i swipe-preview — de dyker upp när kandidaten öppnar annonsen */}
            {publishedLabel && <PreviewPill text={`Publicerad ${publishedLabel}`} />}
          </div>
        </div>
      </div>

      {/* Action-knappar — 3 st (Neka / Spara / Gilla) med tooltip */}
      <div className="absolute inset-x-0 bottom-3 z-[3] flex items-center justify-center gap-3">
        <SwipeActionButton kind="dislike" onOpenForm={onOpenForm} />
        <SwipeActionButton kind="save" onOpenForm={onOpenForm} />
        <SwipeActionButton kind="like" onOpenForm={onOpenForm} />
      </div>

    </div>
    </TooltipProvider>
  );
});

function PreviewPill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)] max-w-full cursor-default">
          {icon}
          <span className="text-[9px] font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
            {text}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function SwipeActionButton({
  kind,
  onOpenForm,
}: {
  kind: 'dislike' | 'save' | 'like';
  onOpenForm?: (e: MouseEvent) => void;
}) {
  const common =
    'w-8 h-8 rounded-full flex items-center justify-center shadow-lg active:scale-[0.93] transition-transform';
  const iconCls = 'w-4 h-4 text-white';
  const handle = (e: MouseEvent) => {
    e.stopPropagation();
    onOpenForm?.(e);
  };

  let btn: ReactNode;
  let label: string;
  if (kind === 'dislike') {
    label = 'Nej tack';
    btn = (
      <button type="button" onClick={handle} aria-label={label} className={`${common} bg-destructive`}>
        <X className={iconCls} strokeWidth={2.5} />
      </button>
    );
  } else if (kind === 'save') {
    label = 'Spara jobbet';
    btn = (
      <button
        type="button"
        onClick={handle}
        aria-label={label}
        className={`${common} bg-secondary border border-white/25`}
      >
        <Bookmark className={iconCls} strokeWidth={2.25} />
      </button>
    );
  } else {
    label = 'Sök jobbet';
    btn = (
      <button type="button" onClick={handle} aria-label={label} className={`${common} bg-success`}>
        <Heart className={`${iconCls} fill-white`} />
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}


/* -----------------------------------------------------------------------
 * List preview — inuti monitor-mockupen (Steg 4 → Datorvy)
 * Matchar riktiga /my-jobs-kortet (EmployerJobCard) — bild överst,
 * scrollbara info-rader nedanför. Inga Redigera/Ta bort-knappar.
 * ---------------------------------------------------------------------*/

interface WizardListPreviewProps extends WizardPreviewData {
  onOpenForm?: (e: MouseEvent) => void;
  onOpenCompany?: (e: MouseEvent) => void;
}

export const WizardListPreview = memo(function WizardListPreview({
  title,
  companyName,
  companyLogoUrl,
  imageUrl,
  imageFocusPosition,
  employmentTypeLabel,
  workingHours,
  location,
  salaryText,
  benefitsCount = 0,
  applicationsCount = 0,

  daysLeftLabel,
  overlayTextColor,
  recruiterName,
  publishedLabel,
  startDateLabel,
  questionsCount = 0,
  viewsCount = 0,
  isExpired,
  isActive,
  onOpenForm,
}: WizardListPreviewProps) {
  const overlayStyle: CSSProperties = useMemo(
    () => getJobOverlayTextStyle(overlayTextColor),
    [overlayTextColor],
  );
  const initials = useMemo(() => getInitials(companyName || 'Företag'), [companyName]);

  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain"
      onClick={onOpenForm}
    >
      {/* Bild-header — täcker hela monitorns vy (16/10) */}
      <div className="relative w-full aspect-[16/10] overflow-hidden">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: getObjectPosition(imageFocusPosition) }}
              draggable={false}
              loading="eager"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            {/* Centrerad titel över bilden */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[2] px-3 text-center">
              <TruncatedText
                text={title || 'Jobbtitel'}
                className="w-full text-center text-[14px] font-extrabold leading-[1.2] line-clamp-2 [text-shadow:0_2px_6px_rgba(0,0,0,0.55)]"
                style={overlayStyle}
              />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-indigo-900/50 to-slate-900/70 flex flex-col items-center justify-center gap-2 px-3 py-4">
            {companyLogoUrl ? (
              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={companyLogoUrl} alt="" className="w-full h-full object-cover" draggable={false} />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-white/60 tracking-wide">{initials}</span>
              </div>
            )}
            <div className="text-[9px] px-2 py-[2px] border border-white/15 bg-black/40 leading-snug inline-flex items-center max-w-[85%] rounded-full" style={overlayStyle}>
              <Building2 className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
              <span className="truncate font-medium">{companyName || 'Företag'}</span>
            </div>
            <TruncatedText
              text={title || 'Jobbtitel'}
              className="mt-1 w-full text-center text-[13px] font-extrabold leading-[1.2] line-clamp-2 px-2 break-words [text-shadow:0_2px_6px_rgba(0,0,0,0.55)]"
              style={overlayStyle}
            />
          </div>
        )}

        {/* Scroll-indikator — pil nedåt */}
        <div className="absolute inset-x-0 bottom-2 z-[2] flex justify-center pointer-events-none">
          <div className="flex items-center gap-1 bg-black/50 border border-white/15 rounded-full px-2 py-0.5 animate-bounce">
            <ChevronDown className="h-3 w-3 text-white" />
          </div>
        </div>
      </div>

      {/* Info-block — under bilden, syns när man scrollar */}
      <div className="w-full bg-[hsl(215,85%,10%)]/95 backdrop-blur-sm border-t border-white/10 px-3 py-2">
        <div className="space-y-1.5">
          <PreviewRow label="Anställningsform" value={employmentTypeLabel || '–'} />
          <PreviewRow label="Plats" value={location || '–'} />
          <PreviewRow label="Arbetstider" value={workingHours || '–'} />
          <PreviewRow label="Startdatum" value={startDateLabel || '–'} />
          <PreviewRow label="Lön" value={salaryText || '–'} />
          <PreviewRow
            label="Förmåner"
            value={benefitsCount > 0 ? `${benefitsCount} st` : '–'}
          />
          {/* Frågor visas inte i förhandsvisningen — kandidaten ser dem först när annonsen öppnas */}
          <PreviewRow label="Publicerad" value={publishedLabel || formatDateShortSv(new Date().toISOString())} />
        </div>
      </div>
    </div>
  );
});


function PreviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] leading-snug text-white">{label}</span>
      <span className="text-[11px] leading-snug text-white font-medium text-right max-w-[62%] break-words">
        {value}
      </span>
    </div>
  );
}



/* -----------------------------------------------------------------------
 * Hjälpare: bygg WizardPreviewData från wizardens formData.
 * ---------------------------------------------------------------------*/

interface BuildPreviewInput {
  title: string;
  occupation?: string;
  companyName: string;
  companyLogoUrl?: string | null;
  imageUrl?: string | null;
  imageFocusPosition?: string;
  employmentTypeLabel?: string;
  employmentTypeDetail?: string;
  workStartTime?: string | null;
  workEndTime?: string | null;
  workSchedule?: string | null;
  location?: string;
  salaryMin?: string | number | null;
  salaryMax?: string | number | null;
  salaryType?: string | null;
  salaryTransparency?: string | null;
  benefits?: string[];
  applicationsCount?: number;
  expiresAt?: string | null;
  overlayTextColor?: string | null;
  recruiterName?: string | null;
  createdAt?: string | null;
  startDate?: string | null;
  questionsCount?: number;
  viewsCount?: number;
  isActive?: boolean;
}

export function buildWizardPreviewData(input: BuildPreviewInput): WizardPreviewData {
  const salaryTypeLabel =
    input.salaryType === 'hourly' || input.salaryType === 'rorlig'
      ? 'kr/tim'
      : 'kr/mån';

  const min = typeof input.salaryMin === 'string' ? parseInt(input.salaryMin, 10) : input.salaryMin ?? null;
  const max = typeof input.salaryMax === 'string' ? parseInt(input.salaryMax, 10) : input.salaryMax ?? null;

  let salaryText: string | null = null;
  if (input.salaryTransparency === 'after_interview') {
    salaryText = 'Lön efter intervju';
  } else if (min && max) {
    salaryText = `${min.toLocaleString('sv-SE')} – ${max.toLocaleString('sv-SE')} ${salaryTypeLabel}`;
  } else if (min || max) {
    salaryText = `Från ${(min || max)!.toLocaleString('sv-SE')} ${salaryTypeLabel}`;
  } else if (input.salaryTransparency && /^\d/.test(input.salaryTransparency)) {
    const match = input.salaryTransparency.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      salaryText = `${parseInt(match[1], 10).toLocaleString('sv-SE')} – ${parseInt(match[2], 10).toLocaleString('sv-SE')} ${salaryTypeLabel}`;
    }
  }

  // Days-left används bara för faktisk utgången status — aldrig som standardpill.
  let daysLeftLabel: string | undefined;
  let isExpired = false;
  if (input.expiresAt) {
    const diffMs = new Date(input.expiresAt).getTime() - Date.now();
    if (diffMs <= 0) {
      isExpired = true;
      daysLeftLabel = 'Utgången';
    } else {
      const diff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      daysLeftLabel = diff === 0 ? 'Sista dagen' : `${diff} dagar kvar`;
    }
  }

  const employmentTypeCombined = [input.employmentTypeLabel, input.employmentTypeDetail]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ') || undefined;

  const metaParts = [employmentTypeCombined, input.location].filter(Boolean);

  const startTime = input.workStartTime?.trim();
  const endTime = input.workEndTime?.trim();
  const workingHours =
    startTime && endTime
      ? `${startTime} – ${endTime}`
      : startTime || endTime || input.workSchedule?.trim() || null;

  const publishedLabel = input.createdAt
    ? formatDateShortSv(input.createdAt)
    : formatDateShortSv(new Date().toISOString());

  return {
    title: input.title,
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl,
    imageUrl: input.imageUrl,
    imageFocusPosition: input.imageFocusPosition,
    occupation: input.occupation || null,
    metaLine: metaParts.join(' • '),
    employmentTypeLabel: employmentTypeCombined,
    workingHours,
    location: input.location,
    salaryText,
    benefitsCount: input.benefits?.length ?? 0,
    applicationsCount: input.applicationsCount ?? 0,
    daysLeftLabel,
    overlayTextColor: normalizeJobOverlayTextColor(input.overlayTextColor ?? DEFAULT_JOB_OVERLAY_TEXT_COLOR),
    recruiterName: input.recruiterName ?? null,
    publishedLabel,
    startDateLabel: input.startDate ? formatDateShortSv(input.startDate) : null,
    questionsCount: input.questionsCount ?? 0,
    viewsCount: input.viewsCount ?? 0,
    isExpired,
    isActive: input.isActive,
  };
}
