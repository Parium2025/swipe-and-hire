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
import { ResilientImage } from '@/components/ui/ResilientImage';
import { getCompanyInitials } from '@/lib/companyInitials';
import { formatSalaryTransparencyValue, formatSwedishAmount } from '@/lib/salaryRange';



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
  daysLeftLabel,
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
        className="absolute inset-x-0 top-[14%] bottom-[22%] z-[2] flex items-center justify-center px-2 text-center md:top-[18%] md:bottom-[26%]"
        style={overlayStyle}
      >
        <div className="w-full max-w-[95%]">
          {/* Logga */}
          <div className="mb-0.5 flex justify-center md:mb-1">
            {companyLogoUrl ? (
              <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[hsl(215,85%,15%)] shadow-lg md:h-7 md:w-7">
                <ResilientImage
                  src={companyLogoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                  fallbackClassName="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/10 md:h-7 md:w-7">
                <span className="text-[7px] font-bold text-white/70 md:text-[8px]">
                  {getCompanyInitials(companyName)}
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
                   className="inline-flex max-w-[90%] items-center gap-0.5 rounded-full border border-white/10 bg-black/45 px-1 py-px shadow-[0_1px_2px_rgba(0,0,0,0.35)] md:gap-1 md:px-1.5 md:py-[2px]"
                >
                   <Building2 className="h-1.5 w-1.5 shrink-0 text-white md:h-2 md:w-2" />
                   <span className="truncate text-[7px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] md:text-[8px]">
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
              <div className="mt-1 cursor-default md:mt-2">
                <TruncatedText
                  text={title || 'Jobbtitel'}
                   className="w-full break-words pb-[0.14em] text-[10px] font-extrabold leading-[1.2] tracking-tight line-clamp-2 md:text-[12px] md:leading-[1.25]"
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
                   className="mt-1 truncate text-[7px] font-semibold cursor-default md:mt-1.5 md:text-[8px]"
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

          {/* Badge-rad — 1:1 med riktiga swipe mode (JobSlideBadgesRow):
              lön, start, publicerad • dagar kvar, förmåner, sökande */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1 md:mt-3 md:gap-1.5">
            {salaryText && <PreviewPill text={salaryText} />}
            <PreviewPill
              text={`Start ${
                !startDateLabel || startDateLabel === 'Omgående'
                  ? 'omgående'
                  : toSwipeDate(startDateLabel)
              }`}
            />
            <PreviewPill
              text={[
                `Publicerad ${toSwipeDate(publishedLabel || formatDateShortSv(new Date().toISOString()))}`,
                daysLeftLabel === 'Utgången' ? null : daysLeftLabel,
              ]
                .filter(Boolean)
                .join(' • ')}
            />
            {benefitsCount > 0 && (
              <PreviewPill
                icon={<Gift className="h-1.5 w-1.5 text-white md:h-2 md:w-2" />}
                text={`Förmåner ${benefitsCount <= 5 ? `${benefitsCount} st` : `${Math.floor(benefitsCount / 5) * 5}+`}`}
              />
            )}
            {applicationsCount > 0 && (
              <PreviewPill
                icon={<Users className="h-1.5 w-1.5 text-white md:h-2 md:w-2" />}
                text={`${applicationsCount} sökande`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Action-knappar — 3 st (Neka / Spara / Gilla) med tooltip */}
      <div className="absolute inset-x-0 bottom-2 z-[3] flex items-center justify-center gap-2 md:bottom-3 md:gap-3">
        <SwipeActionButton kind="dislike" onOpenForm={onOpenForm} />
        <SwipeActionButton kind="save" onOpenForm={onOpenForm} />
        <SwipeActionButton kind="like" onOpenForm={onOpenForm} />
      </div>

    </div>
    </TooltipProvider>
  );
});

/** Swipe mode visar 'd MMM' ("23 sep") — ta bort punkt och årtal. */
function toSwipeDate(label: string): string {
  return label.replace(/\.?\s*\d{4}$/, '').replace(/\.$/, '').trim();
}

function PreviewPill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex max-w-full cursor-default items-center gap-0.5 rounded-full border border-white/10 bg-black/45 px-1.5 py-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.35)] md:gap-1 md:px-2 md:py-1">
          {icon}
          <span className="truncate text-[7px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] md:text-[9px]">
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
    'flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-transform active:scale-[0.93] md:h-8 md:w-8';
  const iconCls = 'h-3 w-3 text-white md:h-4 md:w-4';
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

  return (
    <div
      className="no-chrome-pad absolute inset-0 z-10 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-none bg-card-parium snap-y snap-mandatory"
      onClick={onOpenForm}
    >
      {/* Bild-header — täcker hela monitorns vy (16/10) */}
      <div className="relative w-full min-h-full overflow-hidden snap-start">
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
                <ResilientImage src={companyLogoUrl} alt="" className="w-full h-full object-cover" draggable={false} fallbackClassName="absolute inset-0 h-full w-full" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white/60">
                  {getCompanyInitials(companyName)}
                </span>
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
      <div className="flex min-h-full w-full items-center bg-card-parium backdrop-blur-sm border-t border-white/10 px-3 py-2 snap-start">
        <div className="w-full space-y-1.5">
          <PreviewRow label="Anställningsform" value={employmentTypeLabel || '–'} />
          <PreviewRow label="Plats" value={location || '–'} />
          <PreviewRow label="Arbetstider" value={workingHours || '–'} />
          <PreviewRow label="Startdatum" value={startDateLabel || 'Omgående'} />
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
  // Samma radmall som i den riktiga annonsen: etikett med kolon till vänster,
  // värdet tar resten av bredden, kapas på en rad och visar hela texten i en
  // tooltip om det inte får plats.
  const text = typeof value === 'string' ? value : undefined;
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="text-[11px] leading-snug text-white flex-shrink-0">{label}:</span>
      {text !== undefined ? (
        <TruncatedText
          text={text}
          className="min-w-0 flex-1 truncate text-right text-[11px] leading-snug text-white font-medium"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-right text-[11px] leading-snug text-white font-medium">
          {value}
        </span>
      )}
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
    salaryText = `${formatSwedishAmount(min)} – ${formatSwedishAmount(max)} ${salaryTypeLabel}`;
  } else if (min || max) {
    const amount = min || max;
    salaryText = amount ? `Från ${formatSwedishAmount(amount)} ${salaryTypeLabel}` : null;
  } else if (input.salaryTransparency && /^\d/.test(input.salaryTransparency)) {
    salaryText = formatSalaryTransparencyValue(input.salaryTransparency, salaryTypeLabel);
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
    startDateLabel: input.startDate ? formatDateShortSv(input.startDate) : 'Omgående',
    questionsCount: input.questionsCount ?? 0,
    viewsCount: input.viewsCount ?? 0,
    isExpired,
    isActive: input.isActive,
  };
}
