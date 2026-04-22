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
}: TruncatedTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const tooltipContentRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopHovering, setIsDesktopHovering] = useState(false);
  const [isDesktopFocused, setIsDesktopFocused] = useState(false);

  const { isTouch, supportsHover } = ENV;

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
    return () => setIsOpen(false);
  }, []);

  useEffect(() => {
    if (forceClosed) {
      setIsOpen(false);
      setIsDesktopHovering(false);
      setIsDesktopFocused(false);
    }
  }, [forceClosed]);

  // Reset measurement when text content changes
  useEffect(() => {
    setHasMeasured(false);
    setIsTruncated(false);
  }, [text]);

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
    if (supportsHover) measureTruncation();
  };

  const handleFocus = () => {
    measureTruncation();
  };

  // Determine whether to show tooltip based on environment and props
  const showTooltipDesktop = supportsHover && (tooltipForcedOn || isTruncated);
  const showTooltipTouch = !supportsHover && isTouch && (alwaysShowTooltip === true || isTruncated);
  const shouldShowTooltip = showTooltipDesktop || showTooltipTouch;

  const wordBreakStyles: React.CSSProperties = {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    ...style,
  };

  // Lightweight initial render: no tooltip wrapper, no measurement.
  // We attach hover/focus/touch handlers so tooltip is wired the moment
  // the user actually interacts.
  if (!shouldShowTooltip) {
    return (
      <div
        ref={textRef}
        className={className}
        style={wordBreakStyles}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        onTouchStart={isTouch && !supportsHover ? measureTruncation : undefined}
        // Native title fallback gives users immediate feedback before our
        // tooltip wraps the element on next render
        title={hasMeasured ? undefined : text}
      >
        {children || text}
      </div>
    );
  }

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

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100} disableHoverableContent={false}>
      <Tooltip
        open={forceClosed ? false : !supportsHover ? isOpen : undefined}
        onOpenChange={forceClosed ? undefined : !supportsHover ? setIsOpen : undefined}
        disableHoverableContent={false}
      >
        <TooltipTrigger asChild>
          <div
            ref={textRef}
            className={`${className ?? ""} cursor-pointer pointer-events-auto`}
            style={wordBreakStyles}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onFocus={handleFocus}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children || text}
          </div>
        </TooltipTrigger>
        <TooltipContent
          ref={tooltipContentRef}
          allowOutsidePointerEvents
          side={tooltipSide}
          align="center"
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={12}
          sticky="always"
          className={`z-[999999] w-[min(calc(100vw-24px),360px)] max-w-[min(calc(100vw-24px),360px)] sm:w-auto sm:max-w-[min(90vw,600px)] max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] bg-slate-900/95 border border-white/20 text-white shadow-2xl p-3 pointer-events-auto rounded-lg ${instantClose ? 'data-[state=closed]:animate-none' : ''}`}
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
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
