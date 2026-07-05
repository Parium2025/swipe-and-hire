import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AutoFitTitleProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  minFontPx?: number;
  maxFontPx?: number;
  minScaleX?: number;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  onClick?: () => void;
}

const detectEnv = () => {
  if (typeof window === 'undefined') {
    return { isTouch: false, supportsHover: true };
  }
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const supportsHover =
    'matchMedia' in window
      ? window.matchMedia('(hover: hover)').matches ||
        window.matchMedia('(pointer: fine)').matches
      : true;
  return { isTouch, supportsHover };
};

const ENV = detectEnv();

/**
 * Titel som ALLTID renderas på en enda rad.
 *
 * Beteende:
 *   1. Text renderas med `white-space: nowrap` + `overflow: hidden` +
 *      `text-overflow: ellipsis`.
 *   2. Om texten inte får plats på en rad krympas font-size stegvis (0.25px)
 *      ner till `minFontPx`.
 *   3. Om texten fortfarande inte får plats vid `minFontPx` trunkeras den
 *      med ellipsis och en tooltip visar hela titeln (hover på desktop,
 *      tryck på touch).
 *
 * Passar jobbtitlar, kortrubriker och andra ställen där brytning över flera
 * rader ser fult ut men fullständig text ändå måste vara tillgänglig.
 */
export function AutoFitTitle({
  text,
  className,
  style,
  minFontPx = 12,
  maxFontPx,
  minScaleX = 0.72,
  tooltipSide = 'top',
  onClick,
}: AutoFitTitleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  const { isTouch, supportsHover } = ENV;

  useLayoutEffect(() => {
    const el = ref.current;
    const textEl = textRef.current;
    if (!el || !textEl) {
      setTruncated(false);
      return;
    }
    if (!text) {
      el.style.fontSize = '';
      textEl.style.transform = '';
      setTruncated(false);
      return;
    }

    let frame = 0;

    const resetTextPaint = () => {
      textEl.style.transform = '';
      textEl.style.maxWidth = '';
      textEl.style.overflow = 'visible';
      textEl.style.textOverflow = 'clip';
    };

    const measureAt = (fontPx: number) => {
      el.style.fontSize = `${fontPx}px`;
      resetTextPaint();
      return textEl.scrollWidth;
    };

    const fit = () => {
      cancelAnimationFrame(frame);

      // Reset any previously applied font-size so we can read the class-defined size
      el.style.fontSize = '';
      resetTextPaint();

      frame = requestAnimationFrame(() => {
        const availableWidth = el.clientWidth - 2; // säkerhetsmarginal

        if (availableWidth <= 0) return;

        const baseFontPx = parseFloat(getComputedStyle(el).fontSize) || 16;
        const ceiling = Math.max(minFontPx, maxFontPx ?? baseFontPx);
        const scaleFloor = Math.min(1, Math.max(0.5, minScaleX));

        // Start at the ceiling, then only shrink if the horizontal compression
        // would become visually too aggressive. This keeps normal titles as
        // large as possible while still locked to one row.
        let chosenFont = ceiling;
        let naturalWidth = measureAt(chosenFont);
        let scale = naturalWidth > 0 ? Math.min(1, availableWidth / naturalWidth) : 1;

        if (naturalWidth > availableWidth && scale < scaleFloor) {
          let low = minFontPx;
          let high = ceiling;
          let best = minFontPx;

          for (let i = 0; i < 18; i += 1) {
            const mid = (low + high) / 2;
            const widthAtMid = measureAt(mid);
            const scaleAtMid = widthAtMid > 0 ? availableWidth / widthAtMid : 1;

            if (widthAtMid <= availableWidth || scaleAtMid >= scaleFloor) {
              best = mid;
              low = mid;
            } else {
              high = mid;
            }
          }

          chosenFont = best;
          naturalWidth = measureAt(chosenFont);
          scale = naturalWidth > 0 ? Math.min(1, availableWidth / naturalWidth) : 1;
        }

        const shouldTruncate = chosenFont <= minFontPx + 0.1 && scale < scaleFloor;

        el.style.fontSize = `${chosenFont}px`;

        if (shouldTruncate) {
          textEl.style.transform = '';
          textEl.style.maxWidth = `${availableWidth}px`;
          textEl.style.overflow = 'hidden';
          textEl.style.textOverflow = 'ellipsis';
          setTruncated(true);
          return;
        }

        textEl.style.maxWidth = '';
        textEl.style.overflow = 'visible';
        textEl.style.textOverflow = 'clip';
        textEl.style.transform = scale < 0.999 ? `scaleX(${scale})` : '';
        setTruncated(false);
      });
    };


    const timeout = setTimeout(fit, 30);
    const ro = new ResizeObserver(() => {
      // Debounce via microtask; keeps things cheap on rapid layout changes
      setTimeout(fit, 10);
    });
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [text, minFontPx, maxFontPx, minScaleX]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isTouch && !supportsHover && truncated) {
        e.stopPropagation();
        setOpen((prev) => !prev);
        return;
      }
      onClick?.();
    },
    [isTouch, supportsHover, truncated, onClick]
  );

  const mergedStyle: React.CSSProperties = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    ...style,
  };

  const inner = (
    <div
      ref={ref}
      className={className}
      style={mergedStyle}
      onClick={handleClick}
    >
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'visible',
          textOverflow: 'clip',
          transformOrigin: 'center',
          verticalAlign: 'top',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );

  if (!truncated) return inner;

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent
          side={tooltipSide}
          align="center"
          sideOffset={8}
          avoidCollisions
          collisionPadding={12}
          className="z-[999999] max-w-[min(calc(100vw-24px),360px)] bg-slate-900/95 border border-white/20 text-white shadow-2xl p-3 rounded-lg"
        >
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {text}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
