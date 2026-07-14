import { memo, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { AutoFitTitle } from '@/components/ui/AutoFitTitle';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getCompanyInitials } from '@/components/swipe/jobSlide/utils';

interface WizardSwipeCardOverlayProps {
  size: 'sm' | 'md';
  companyName: string;
  companyLogoUrl?: string | null;
  title: string;
  occupation?: string | null;
  metaLine?: string;
  overlayTextColor?: string | null;
  onCompanyClick?: (e: MouseEvent) => void;
  /** AutoFitTitle bounds — samma som befintlig wizard-preview. */
  titleMinFontPx?: number;
  titleMaxFontPx?: number;
  /** Extra element renderade under meta (t.ex. tap-hint). */
  children?: ReactNode;
}

/**
 * Ren visuell "swipe-kort-överlägg" för wizard-preview:et. Matchar
 * JobSlideContent (yrkesbadge top-left, logga i cirkel, företagspill med
 * Building2, titel, meta) — bantad till mockup-skala.
 *
 * Ingen badge-rad (lön/publicerad/förmåner/sökande) enligt beslut.
 */
export const WizardSwipeCardOverlay = memo(function WizardSwipeCardOverlay({
  size,
  companyName,
  companyLogoUrl,
  title,
  occupation,
  metaLine,
  overlayTextColor,
  onCompanyClick,
  titleMinFontPx = 15,
  titleMaxFontPx = 26,
  children,
}: WizardSwipeCardOverlayProps) {
  const isMd = size === 'md';
  const textStyle: CSSProperties = getJobOverlayTextStyle(overlayTextColor);

  // Skalade dimensioner för mockup-storlek
  const logoSize = isMd ? 'w-11 h-11' : 'w-8 h-8';
  const logoInitials = isMd ? 'text-sm' : 'text-[10px]';
  const companyPillText = isMd ? 'text-[11px]' : 'text-[9px]';
  const companyPillIcon = isMd ? 'h-3 w-3' : 'h-2.5 w-2.5';
  const companyPillPad = isMd ? 'px-2.5 py-1' : 'px-1.5 py-0.5';
  const occupationText = isMd ? 'text-[10px]' : 'text-[8px]';
  const occupationPad = isMd ? 'px-2 py-0.5' : 'px-1.5 py-[1px]';
  const titleClass = isMd
    ? 'w-full font-extrabold leading-[1.08] tracking-tight'
    : 'w-full font-extrabold leading-[1.08] tracking-tight';
  const metaClass = isMd
    ? 'text-[11px] font-semibold mt-1 truncate max-w-full'
    : 'text-[9px] font-semibold mt-0.5 truncate max-w-full';

  return (
    <>
      {/* Yrkesbadge — absolut, top-left, som riktiga kortet */}
      {occupation && (
        <div className="pointer-events-none absolute top-2 left-2 z-[3]">
          <div
            className={`${occupationPad} rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]`}
          >
            <span
              className={`${occupationText} font-semibold tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]`}
            >
              {occupation}
            </span>
          </div>
        </div>
      )}

      {/* Logga i cirkel */}
      <div className="flex justify-center mb-1.5">
        {companyLogoUrl ? (
          <div
            className={`${logoSize} rounded-full bg-[hsl(215,85%,15%)] border border-white/10 flex items-center justify-center overflow-hidden shadow-lg`}
          >
            <img
              src={companyLogoUrl}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        ) : (
          <div
            className={`${logoSize} rounded-full bg-white/10 border border-white/10 flex items-center justify-center`}
          >
            <span className={`${logoInitials} font-bold text-white/60 tracking-wide select-none`}>
              {getCompanyInitials(companyName || 'Företag')}
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
            onCompanyClick?.(e);
          }}
          className={`inline-flex max-w-[85%] items-center gap-1 ${companyPillPad} rounded-full bg-black/45 border border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35)]`}
        >
          <Building2 className={`${companyPillIcon} shrink-0 text-white`} />
          <span
            className={`${companyPillText} font-semibold text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]`}
          >
            {companyName || 'Företag'}
          </span>
        </button>
      </div>

      {/* Titel */}
      <AutoFitTitle
        text={title || 'Jobbtitel'}
        className={`${titleClass} mt-1`}
        style={textStyle}
        minFontPx={titleMinFontPx}
        maxFontPx={titleMaxFontPx}
      />

      {/* Meta */}
      {metaLine && (
        <div className={metaClass} style={textStyle}>
          {metaLine}
        </div>
      )}

      {children}
    </>
  );
});
