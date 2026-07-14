import { memo, useMemo, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  Bookmark,
  Building2,
  Eye,
  Gift,
  Heart,
  Users,
  X,
} from 'lucide-react';
import { AutoFitTitle } from '@/components/ui/AutoFitTitle';
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
  location?: string;
  salaryText?: string | null;
  benefitsCount?: number;
  applicationsCount?: number;
  daysLeftLabel?: string;
  overlayTextColor?: string | null;
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
  salaryText,
  benefitsCount = 0,
  applicationsCount = 0,
  daysLeftLabel,
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

          {/* Titel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <AutoFitTitle
                  text={title || 'Jobbtitel'}
                  className="mt-0.5 w-full font-extrabold leading-[1.05] tracking-tight line-clamp-2"
                  style={overlayStyle}
                  minFontPx={11}
                  maxFontPx={14}
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
                  className="mt-0.5 text-[8px] font-semibold truncate cursor-default"
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
            {salaryText && <PreviewPill text={salaryText} />}
            {daysLeftLabel && <PreviewPill text={daysLeftLabel} />}
            {benefitsCount > 0 && (
              <PreviewPill
                icon={<Gift className="h-2 w-2 text-white" />}
                text={`Förmåner ${benefitsCount <= 5 ? `${benefitsCount} st` : `${Math.floor(benefitsCount / 5) * 5}+`}`}
              />
            )}
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
 * Använder samma layout som swipe mode så mockuperna matchar exakt.
 * ---------------------------------------------------------------------*/

interface WizardListPreviewProps extends WizardPreviewData {
  onOpenForm?: (e: MouseEvent) => void;
  onOpenCompany?: (e: MouseEvent) => void;
}

export const WizardListPreview = memo(function WizardListPreview(
  props: WizardListPreviewProps,
) {
  return <WizardSwipePreview {...props} />;
});


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
  location?: string;
  salaryMin?: string | number | null;
  salaryMax?: string | number | null;
  salaryType?: string | null;
  salaryTransparency?: string | null;
  benefits?: string[];
  applicationsCount?: number;
  expiresAt?: string | null;
  overlayTextColor?: string | null;
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

  // Days-left: från expires_at om satt, annars 30 dagar (standardpublicering).
  let daysLeftLabel: string | undefined;
  if (input.expiresAt) {
    const diff = Math.max(
      0,
      Math.floor(
        (new Date(input.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
    daysLeftLabel = diff === 0 ? 'Sista dagen' : `${diff} dagar kvar`;
  } else {
    daysLeftLabel = '30 dagar kvar';
  }

  const employmentLabelWithDetail = [input.employmentTypeLabel, input.employmentTypeDetail]
    .filter(Boolean)
    .join(' · ');

  const metaParts = [employmentLabelWithDetail, input.location].filter(Boolean);

  return {
    title: input.title,
    companyName: input.companyName,
    companyLogoUrl: input.companyLogoUrl,
    imageUrl: input.imageUrl,
    imageFocusPosition: input.imageFocusPosition,
    occupation: input.occupation || null,
    metaLine: metaParts.join(' • '),
    employmentTypeLabel: employmentLabelWithDetail || undefined,
    location: input.location,
    salaryText,
    benefitsCount: input.benefits?.length ?? 0,
    applicationsCount: input.applicationsCount ?? 0,
    daysLeftLabel,
    overlayTextColor: normalizeJobOverlayTextColor(input.overlayTextColor ?? DEFAULT_JOB_OVERLAY_TEXT_COLOR),
  };
}
