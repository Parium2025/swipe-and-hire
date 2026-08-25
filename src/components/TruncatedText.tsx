import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTextProps {
  text: string;
  className?: string;
  children?: React.ReactNode;
  alwaysShowTooltip?: boolean | 'desktop-only';
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  onClick?: () => void;
  forceClosed?: boolean;
  instantClose?: boolean;
  style?: React.CSSProperties;
  /**
   * Number of lines to clamp to. When set, the component owns the clamp
   * via inline styles (source of truth), overriding any `line-clamp-*`
   * class in `className`. Omit to keep the legacy behaviour where the
   * className drives the clamp.
   */
  lines?: number;
}

// Module-level lazy detection of touch/hover capability — runs ONCE for the
// entire app instead of in every TruncatedText instance.
// Previously each instance ran 2 useEffects + matchMedia subscriptions just
// to figure this out, multiplied by 60+ instances on the dashboard.
const detectEnv = () => {
  if (typeof window === "undefined") {
    return { isTouch: false, supportsHover: true };
  }
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const supportsHover =
    "matchMedia" in window
      ? window.matchMedia("(hover: hover)").matches ||
        window.matchMedia("(pointer: fine)").matches
      : true;
  return { isTouch, supportsHover };
};

const ENV = detectEnv();

// Rensar bort osynliga tecken (zero-width, BOM, U+2028/2029, \r) och
// tomma rader i slutet — annars får tooltip-bubblan ett stort tomrum längst ner.
const sanitizeTooltipText = (value?: string) => {
  if (!value) return value;
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF\u2028\u2029]/g, '')
    .replace(/[ \t\u00A0]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
};

// Singleton tracker — only one TruncatedText tooltip can be open at a time.
// This prevents the "double tooltip" bug where two cards' tooltips overlap
// when the user moves the mouse from one card to an adjacent one.
let activeCloseFn: (() => void) | null = null;
const registerOpenTooltip = (closeFn: () => void) => {
  if (activeCloseFn && activeCloseFn !== closeFn) {
    activeCloseFn();
  }
  activeCloseFn = closeFn;
};
const unregisterOpenTooltip = (closeFn: () => void) => {
  if (activeCloseFn === closeFn) {
    activeCloseFn = null;
  }
};

/**
 * Component that automatically detects if text is truncated and shows
 * a tooltip with the full text on hover.
 *
 * PERFORMANCE: Truncation detection is now LAZY — it runs ONLY when the user
 * actually hovers/touches the element. Previously this component ran 5+ DOM
 * cloning + reflow operations at mount time, which was the #1 cause of the
 * tab-switch stutter on the dashboard (60 instances × 5 measurements = 300
 * forced layouts per tab change).
 */
export function TruncatedText({
  text,
  className,
  children,
  alwaysShowTooltip,
  tooltipSide = 'top',
  onClick,
  forceClosed = false,
  instantClose = false,
  style,
  lines,
}: TruncatedTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const tooltipContentRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopHovering, setIsDesktopHovering] = useState(false);
  const [isDesktopFocused, setIsDesktopFocused] = useState(false);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);

  const { isTouch, supportsHover } = ENV;

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleDesktopClose = useCallback(() => {
    if (!supportsHover) return;
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsDesktopHovering(false);
      setIsDesktopFocused(false);
      setIsTooltipHovered(false);
      setIsOpen(false);
    }, 140);
  }, [clearCloseTimeout, supportsHover]);

  // Lazy truncation measurement — runs only the first time the user
  // hovers/touches the element. Cheap on first paint, accurate on demand.
  const measureTruncation = useCallback(() => {
    if (hasMeasured) return;
    const element = textRef.current;
    if (!element) return;

    const styles = window.getComputedStyle(element);
    const webkitLineClamp = (styles.getPropertyValue("-webkit-line-clamp") || "").trim();
    const hasClamp = webkitLineClamp !== "" && webkitLineClamp !== "none";

    let truncated = false;
    if (hasClamp) {
      // Cheaper than cloning: temporarily remove the clamp on the live element,
      // measure, then restore. Single forced layout instead of clone+append+remove.
      const originalLineClamp = (element.style as any).webkitLineClamp;
      const originalDisplay = element.style.display;
      const originalMaxHeight = element.style.maxHeight;
      const originalOverflow = element.style.overflow;

      const currentHeight = element.clientHeight;

      // @ts-ignore - vendor property
      element.style.webkitLineClamp = "unset";
      element.style.display = "block";
      element.style.maxHeight = "none";
      element.style.overflow = "visible";

      const naturalHeight = element.scrollHeight;

      // @ts-ignore - vendor property
      element.style.webkitLineClamp = originalLineClamp;
      element.style.display = originalDisplay;
      element.style.maxHeight = originalMaxHeight;
      element.style.overflow = originalOverflow;

      truncated = naturalHeight > currentHeight + 1;
    } else {
      truncated =
        Math.ceil(element.scrollHeight) > Math.ceil(element.clientHeight) ||
        Math.ceil(element.scrollWidth) > Math.ceil(element.clientWidth);
    }

    setIsTruncated(truncated);
    setHasMeasured(true);
  }, [hasMeasured]);

  // If alwaysShowTooltip is set, we don't need to measure at all
  const tooltipForcedOn = alwaysShowTooltip === true || alwaysShowTooltip === 'desktop-only';

  // Close tooltip immediately when component unmounts (e.g. sheet closing)
  useEffect(() => {
    return () => {
      clearCloseTimeout();
      setIsOpen(false);
    };
  }, [clearCloseTimeout]);

  useEffect(() => {
    if (forceClosed) {
      clearCloseTimeout();
      setIsOpen(false);
      setIsDesktopHovering(false);
      setIsDesktopFocused(false);
      setIsTooltipHovered(false);
    }
  }, [forceClosed, clearCloseTimeout]);

  // Reset measurement when text content changes
  useEffect(() => {
    clearCloseTimeout();
    setHasMeasured(false);
    setIsTruncated(false);
    setIsDesktopHovering(false);
    setIsDesktopFocused(false);
    setIsTooltipHovered(false);
    setIsOpen(false);
  }, [text, clearCloseTimeout]);

  // EAGER MEASUREMENT FOR TOUCH DEVICES
  // On touch devices there is no hover, so the user's first tap must already
  // open the tooltip. We measure synchronously after layout so the tooltip
  // wrapper is wired up on first paint. Desktop still uses lazy measurement
  // on hover for performance (60+ instances on dashboards).
  useLayoutEffect(() => {
    if (tooltipForcedOn) return;
    if (supportsHover) return; // desktop: stay lazy
    if (!isTouch) return;
    if (hasMeasured) return;
    // Defer one frame so layout (clamp, fonts) is settled
    const id = requestAnimationFrame(() => measureTruncation());
    return () => cancelAnimationFrame(id);
  }, [text, tooltipForcedOn, supportsHover, isTouch, hasMeasured, measureTruncation]);

  // RE-MEASURE WHEN THE AVAILABLE WIDTH CHANGES
  // Window resize, iPad/Android rotation, sidebar collapse, dialog resize and
  // late font loading all change whether the text actually fits. Without this
  // the cached measurement goes stale and the tooltip either stops appearing
  // (text now clipped) or appears on text that fits. We only invalidate the
  // cached flag — no layout work happens until the next hover/tap (desktop) or
  // the eager touch pass (mobile).
  useEffect(() => {
    if (tooltipForcedOn) return;
    const element = textRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    let lastWidth = element.getBoundingClientRect().width;
    let frame: number | null = null;

    const invalidate = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const node = textRef.current;
        if (!node) return;
        const width = node.getBoundingClientRect().width;
        if (Math.abs(width - lastWidth) < 1) return;
        lastWidth = width;
        setHasMeasured(false);
        setIsTruncated(false);
      });
    };

    const observer = new ResizeObserver(invalidate);
    observer.observe(element);
    window.addEventListener('orientationchange', invalidate);

    // Late webfont swap changes text metrics without changing box width.
    let cancelled = false;
    const fonts = (document as any).fonts;
    if (fonts?.ready?.then) {
      fonts.ready.then(() => {
        if (cancelled) return;
        setHasMeasured(false);
        setIsTruncated(false);
      });
    }

    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('orientationchange', invalidate);
    };
  }, [tooltipForcedOn]);



  useEffect(() => {
    if (supportsHover || !isTouch || !isOpen) return;

    const handleGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const isInsideTrigger = textRef.current?.contains(target) ?? false;
      const isInsideTooltip = tooltipContentRef.current?.contains(target) ?? false;

      if (isInsideTrigger || isInsideTooltip) return;

      flushSync(() => {
        setIsOpen(false);
      });
    };

    document.addEventListener('pointerdown', handleGlobalPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    };
  }, [isOpen, isTouch, supportsHover]);


  const handleTap = () => {
    if (!supportsHover && isTouch) {
      measureTruncation();
      setIsOpen((o) => !o);
    }
  };

  // Lazy measure on first hover (desktop) or focus (keyboard nav)
  const handleMouseEnter = () => {
    if (supportsHover) {
      clearCloseTimeout();
      setIsDesktopHovering(true);
      measureTruncation();
    }
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    if (supportsHover) {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && tooltipContentRef.current?.contains(nextTarget)) {
        return;
      }
      scheduleDesktopClose();
    }
  };

  const handleFocus = () => {
    clearCloseTimeout();
    setIsDesktopFocused(true);
    measureTruncation();
  };

  const handleBlur = () => {
    scheduleDesktopClose();
  };

  // Determine whether to show tooltip based on environment and props
  const showTooltipDesktop = supportsHover && (tooltipForcedOn || isTruncated);
  const showTooltipTouch = !supportsHover && isTouch && (alwaysShowTooltip === true || isTruncated);
  const shouldShowTooltip = showTooltipDesktop || showTooltipTouch;

  useEffect(() => {
    if (!supportsHover || forceClosed) return;
    const wantsOpen = shouldShowTooltip && (isDesktopHovering || isDesktopFocused || isTooltipHovered);
    setIsOpen(wantsOpen);
  }, [supportsHover, forceClosed, shouldShowTooltip, isDesktopHovering, isDesktopFocused, isTooltipHovered]);

  // Singleton: ensure only one TruncatedText tooltip is open at a time globally.
  // When this tooltip opens, close any other one. When it closes, unregister.
  const closeSelf = useCallback(() => {
    clearCloseTimeout();
    setIsOpen(false);
    setIsDesktopHovering(false);
    setIsDesktopFocused(false);
    setIsTooltipHovered(false);
  }, [clearCloseTimeout]);

  useEffect(() => {
    if (isOpen) {
      registerOpenTooltip(closeSelf);
    } else {
      unregisterOpenTooltip(closeSelf);
    }
    return () => unregisterOpenTooltip(closeSelf);
  }, [isOpen, closeSelf]);

  const clampStyles: React.CSSProperties = lines
    ? {
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }
    : {};

  const wordBreakStyles: React.CSSProperties = {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    ...clampStyles,
    ...style,
  };

  // Stop propagation to prevent parent onClick from firing when interacting with tooltip
  const handleClick = (e: React.MouseEvent) => {
    if (!supportsHover && isTouch) {
      e.stopPropagation();
      handleTap();
    } else if (onClick) {
      onClick();
    }
  };

  const stopTooltipPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleTooltipMouseEnter = () => {
    if (!supportsHover) return;
    clearCloseTimeout();
    setIsTooltipHovered(true);
  };

  const handleTooltipMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!supportsHover) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && textRef.current?.contains(nextTarget)) {
      setIsTooltipHovered(false);
      return;
    }
    scheduleDesktopClose();
  };

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100} disableHoverableContent={false}>
      <Tooltip
        open={forceClosed ? false : isOpen}
        onOpenChange={forceClosed ? undefined : setIsOpen}
        disableHoverableContent={false}
      >
        <TooltipTrigger asChild>
          <div
            ref={textRef}
            className={`${className ?? ""} cursor-pointer pointer-events-auto`}
            style={wordBreakStyles}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onTouchStart={isTouch && !supportsHover ? measureTruncation : undefined}
            onMouseDown={(e) => e.stopPropagation()}
            // No native `title` attribute — it would render a second (gray) browser
            // tooltip on top of our custom one.
          >
            {children || text}
          </div>
        </TooltipTrigger>
        {shouldShowTooltip ? (
          <TooltipContent
            ref={tooltipContentRef}
            allowOutsidePointerEvents
            side={tooltipSide}
            align="center"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={12}
            sticky="always"
            className={`z-[999999] no-chrome-pad w-fit h-fit max-w-[min(calc(100vw-24px),360px)] sm:max-w-[min(90vw,600px)] max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] whitespace-normal bg-slate-900/95 border border-white/20 text-white shadow-2xl p-3 pointer-events-auto rounded-lg ${instantClose ? 'data-[state=closed]:animate-none' : ''}`}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            onPointerDown={stopTooltipPropagation}
            onPointerMove={stopTooltipPropagation}
            onPointerUp={stopTooltipPropagation}
            onTouchStart={stopTooltipPropagation}
            onTouchMove={stopTooltipPropagation}
            onTouchEnd={stopTooltipPropagation}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onScrollCapture={stopTooltipPropagation}
          >
            <p className="text-sm leading-relaxed break-words whitespace-pre-line">
              {sanitizeTooltipText(text)}
            </p>
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  );
}
