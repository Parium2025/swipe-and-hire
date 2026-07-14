import { memo, useMemo, type CSSProperties, type MouseEvent } from 'react';
import {
  Bookmark,
  Building2,
  Briefcase,
  Banknote,
  Gift,
  Heart,
  MapPin,
  Timer,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { AutoFitTitle } from '@/components/ui/AutoFitTitle';
import { TruncatedText } from '@/components/TruncatedText';
import {
  DEFAULT_JOB_OVERLAY_TEXT_COLOR,
  getJobOverlayTextStyle,
  normalizeJobOverlayTextColor,
} from '@/lib/jobOverlayText';

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
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-[hsl(215,85%,15%)] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-[9px] md:text-xs font-bold text-white/70 tracking-wide">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Företagspill */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCompany?.(e);
              }}
              className="inline-flex max-w-[90%] items-center gap-1 px-1.5 py-[2px] md:px-2 md:py-0.5 rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            >
              <Building2 className="h-2 w-2 md:h-2.5 md:w-2.5 shrink-0 text-white" />
              <span className="text-[8px] md:text-[10px] font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                {companyName || 'Företag'}
              </span>
            </button>
          </div>

          {/* Titel */}
          <AutoFitTitle
            text={title || 'Jobbtitel'}
            className="mt-0.5 md:mt-1 w-full font-extrabold leading-[1.05] tracking-tight line-clamp-2"
            style={overlayStyle}
            minFontPx={11}
            maxFontPx={18}
          />

          {/* Meta */}
          {metaLine && (
            <p
              className="mt-0.5 text-[8px] md:text-[10px] font-semibold truncate"
              style={overlayStyle}
            >
              {metaLine}
            </p>
          )}

          {/* Badge-rad — matchar JobSlideBadgesRow */}
          <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
            {salaryText && <PreviewPill text={salaryText} />}
            {daysLeftLabel && <PreviewPill text={daysLeftLabel} />}
            {benefitsCount > 0 && (
              <PreviewPill
                icon={<Gift className="h-2 w-2 md:h-2.5 md:w-2.5 text-white" />}
                text={`Förmåner ${benefitsCount <= 5 ? `${benefitsCount} st` : `${Math.floor(benefitsCount / 5) * 5}+`}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Action-knappar — 3 st fulla size (Neka / Spara / Gilla) */}
      <div className="absolute inset-x-0 bottom-3 md:bottom-4 z-[3] flex items-center justify-center gap-3 md:gap-4">
        <SwipeActionButton kind="dislike" onOpenForm={onOpenForm} />
        <SwipeActionButton kind="save" onOpenForm={onOpenForm} />
        <SwipeActionButton kind="like" onOpenForm={onOpenForm} />
      </div>

    </div>
  );
});

function PreviewPill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-0.5 px-1.5 py-[2px] md:px-2 md:py-0.5 rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)] max-w-full">
      {icon}
      <span className="text-[7px] md:text-[9px] font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
        {text}
      </span>
    </div>
  );
}

function SwipeActionButton({
  kind,
  onOpenForm,
}: {
  kind: 'dislike' | 'save' | 'like' | 'undo';
  onOpenForm?: (e: MouseEvent) => void;
}) {
  const common = 'w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shadow-md';
  const iconCls = 'w-3 h-3 md:w-4 md:h-4 text-white';
  const handle = (e: MouseEvent) => {
    e.stopPropagation();
    onOpenForm?.(e);
  };
  if (kind === 'dislike') {
    return (
      <button type="button" onClick={handle} aria-label="Nej tack" className={`${common} bg-destructive`}>
        <X className={iconCls} strokeWidth={2.5} />
      </button>
    );
  }
  if (kind === 'save') {
    return (
      <button
        type="button"
        onClick={handle}
        aria-label="Spara"
        className={`${common} bg-secondary border border-white/25`}
      >
        <Bookmark className={iconCls} strokeWidth={2.25} />
      </button>
    );
  }
  if (kind === 'like') {
    return (
      <button type="button" onClick={handle} aria-label="Ansök" className={`${common} bg-success`}>
        <Heart className={`${iconCls} fill-white`} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={handle}
      aria-label="Ångra"
      aria-disabled="true"
      className={`${common} bg-white/15 border border-white/25`}
    >
      <Undo2 className={`${iconCls} opacity-40`} strokeWidth={2.25} />
    </button>
  );
}

/* -----------------------------------------------------------------------
 * List preview — inuti monitor-mockupen (Steg 4 → Datorvy)
 * Matchar ReadOnlyMobileJobCard: bild överst, panel under med
 * titel + glass-pill-rader.
 * ---------------------------------------------------------------------*/

interface WizardListPreviewProps extends WizardPreviewData {
  onOpenForm?: (e: MouseEvent) => void;
}

export const WizardListPreview = memo(function WizardListPreview({
  title,
  companyName,
  companyLogoUrl,
  imageUrl,
  imageFocusPosition,
  employmentTypeLabel,
  location,
  salaryText,
  benefitsCount = 0,
  applicationsCount = 0,
  daysLeftLabel,
  overlayTextColor,
  onOpenForm,
}: WizardListPreviewProps) {
  const overlayStyle: CSSProperties = useMemo(
    () => getJobOverlayTextStyle(overlayTextColor),
    [overlayTextColor],
  );
  const initials = useMemo(() => getInitials(companyName || 'Företag'), [companyName]);

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center p-3 overflow-hidden cursor-pointer"
      onClick={onOpenForm}
    >
      {/* Skalad kopia av riktiga listkortet */}
      <div className="relative w-full max-w-[300px] rounded-xl overflow-hidden border border-white/20 bg-white/5 shadow-2xl">
        {/* Bild-header */}
        <div className="relative w-full" style={{ aspectRatio: '16 / 10' }}>
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-indigo-900/40 to-slate-900/60 flex flex-col items-center justify-center gap-1">
              {companyLogoUrl ? (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 overflow-hidden">
                  <img src={companyLogoUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white/60">{initials}</span>
                </div>
              )}
            </div>
          )}
          {/* Heart top-right — matchar riktiga kortet */}
          <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
            <Heart className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Body */}
        <div className="px-2 py-2 space-y-1.5">
          <TruncatedText
            text={title || 'Jobbtitel'}
            className="text-[11px] font-bold leading-snug line-clamp-2 text-center"
            style={overlayStyle}
          />

          {/* Företag + plats */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <ListPill icon={<Building2 className="h-2.5 w-2.5" />} text={companyName || 'Företag'} />
            {location && <ListPill icon={<MapPin className="h-2.5 w-2.5" />} text={location} />}
          </div>

          {/* Tags-rad */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {employmentTypeLabel && (
              <ListPill icon={<Briefcase className="h-2.5 w-2.5" />} text={employmentTypeLabel} />
            )}
            {salaryText && (
              <ListPill icon={<Banknote className="h-2.5 w-2.5" />} text={salaryText} />
            )}
            {daysLeftLabel && (
              <ListPill icon={<Timer className="h-2.5 w-2.5" />} text={daysLeftLabel} />
            )}
            {benefitsCount > 0 && (
              <ListPill
                icon={<Gift className="h-2.5 w-2.5" />}
                text={`Förmåner ${benefitsCount <= 5 ? `${benefitsCount} st` : `${Math.floor(benefitsCount / 5) * 5}+`}`}
              />
            )}
            <ListPill
              icon={<Users className="h-2.5 w-2.5" />}
              text={`${applicationsCount} sökande`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

function ListPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-[2px] rounded-full border border-white/15 bg-white/10 text-[8px] font-medium leading-snug text-white max-w-full">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
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
