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
  tooltipSide = 'top',
  onClick,
}: AutoFitTitleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [fontSize, setFontSize] = useState<number | null>(null);
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
      setFontSize(null);
      setTruncated(false);
      return;
    }

    const measureAt = (fontPx: number) => {
      textEl.style.fontSize = `${fontPx}px`;
      textEl.style.maxWidth = 'none';
      textEl.style.overflow = 'visible';
      textEl.style.textOverflow = 'clip';
      return textEl.scrollWidth;
    };

    const fit = () => {
      setOpen(false);
      const availableWidth = Math.floor(el.getBoundingClientRect().width) - 2;

      if (availableWidth <= 0) return;

      const baseFontPx = parseFloat(getComputedStyle(el).fontSize) || 16;
      const ceiling = Math.max(minFontPx, maxFontPx ?? baseFontPx);
      const maxWidth = measureAt(ceiling);

      if (maxWidth <= availableWidth) {
        setFontSize(ceiling);
        setTruncated(false);
        return;
      }

      const minWidth = measureAt(minFontPx);

      if (minWidth > availableWidth) {
        setFontSize(minFontPx);
        setTruncated(true);
        return;
      }

      let low = minFontPx;
      let high = ceiling;
      let best = minFontPx;

      for (let i = 0; i < 18; i += 1) {
        const mid = (low + high) / 2;
        if (measureAt(mid) <= availableWidth) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }

      setFontSize(Math.floor(best * 10) / 10);
      setTruncated(false);
    };

    fit();
    const ro = new ResizeObserver(() => {
      fit();
    });
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    return () => {
      ro.disconnect();
    };
  }, [text, minFontPx, maxFontPx]);

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
    overflow: truncated ? 'hidden' : 'visible',
    textOverflow: truncated ? 'ellipsis' : 'clip',
    textAlign: 'center',
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
          width: truncated ? '100%' : 'auto',
          maxWidth: truncated ? '100%' : 'none',
          overflow: truncated ? 'hidden' : 'visible',
          textOverflow: truncated ? 'ellipsis' : 'clip',
          fontSize: fontSize ? `${fontSize}px` : undefined,
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
