import { useCallback, useEffect, useRef, useState } from 'react';
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
  tooltipSide = 'top',
  onClick,
}: AutoFitTitleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  const { isTouch, supportsHover } = ENV;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setTruncated(false);
      return;
    }
    if (!text) {
      el.style.fontSize = '';
      setTruncated(false);
      return;
    }

    const fit = () => {
      // Reset any previously applied font-size so we start from the class-defined size
      el.style.fontSize = '';

      requestAnimationFrame(() => {
        const parent = el.parentElement;
        if (!parent) return;

        const parentStyles = getComputedStyle(parent);
        const availableWidth =
          parent.clientWidth -
          parseFloat(parentStyles.paddingLeft || '0') -
          parseFloat(parentStyles.paddingRight || '0') -
          2; // säkerhetsmarginal

        if (availableWidth <= 0) return;

        const baseFontPx = parseFloat(getComputedStyle(el).fontSize) || 16;
        let currentFont = baseFontPx;

        // scrollWidth reflects natural single-line width because nowrap is set
        let width = el.scrollWidth;

        while (width > availableWidth && currentFont > minFontPx) {
          currentFont = Math.max(minFontPx, currentFont - 0.25);
          el.style.fontSize = `${currentFont}px`;
          width = el.scrollWidth;
          if (currentFont <= minFontPx) break;
        }

        setTruncated(el.scrollWidth > el.clientWidth + 1);
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
      clearTimeout(timeout);
    };
  }, [text, minFontPx]);

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
      {text}
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
