import { useEffect, useRef, useState } from "react";
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

/**
 * Component that automatically detects if text is truncated and shows
 * a tooltip with the full text on hover
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
  const [isTouch, setIsTouch] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [supportsHover, setSupportsHover] = useState(true);

  useEffect(() => {
    setIsTouch(typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      const mqHover = window.matchMedia("(hover: hover)");
      const mqFine = window.matchMedia("(pointer: fine)");
      const update = () => setSupportsHover(mqHover.matches || mqFine.matches);
      update();
      mqHover.addEventListener?.("change", update);
      mqFine.addEventListener?.("change", update);
      return () => {
        mqHover.removeEventListener?.("change", update);
        mqFine.removeEventListener?.("change", update);
      };
    } else {
      setSupportsHover(true);
    }
  }, []);

  useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current;
      if (!element) return;

      // Robust detection including multi-line clamp (-webkit-line-clamp)
      const styles = window.getComputedStyle(element);
      const webkitLineClamp = (styles.getPropertyValue("-webkit-line-clamp") || "").trim();
      const hasClamp = webkitLineClamp !== "" && webkitLineClamp !== "none";

      let truncated = false;
      if (hasClamp) {
        // Measure natural height without clamp by cloning the element offscreen
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.position = "absolute";
        clone.style.visibility = "hidden";
        clone.style.pointerEvents = "none";
        // @ts-ignore - vendor property
        clone.style.webkitLineClamp = "unset";
        clone.style.display = "block";
        clone.style.maxHeight = "none";
        clone.style.overflow = "visible";
        clone.style.width = `${element.clientWidth}px`;
        element.parentElement?.appendChild(clone);
        const naturalHeight = Math.ceil(clone.scrollHeight);
        element.parentElement?.removeChild(clone);
        const currentHeight = Math.ceil(element.clientHeight);
        truncated = naturalHeight > currentHeight + 1;
      } else {
        truncated =
          Math.ceil(element.scrollHeight) > Math.ceil(element.clientHeight) ||
          Math.ceil(element.scrollWidth) > Math.ceil(element.clientWidth);
      }

      setIsTruncated(truncated);
    };

    // Run immediately and schedule a few short re-checks
    checkTruncation();
    const raf = requestAnimationFrame(checkTruncation);
    const timeouts = [
      setTimeout(checkTruncation, 50),
      setTimeout(checkTruncation, 150),
      setTimeout(checkTruncation, 300),
    ];

    // Also check on resize of the element
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkTruncation, 50);
    });

    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [text]);

  // Close tooltip immediately when component unmounts (e.g. sheet closing)
  useEffect(() => {
    return () => setIsOpen(false);
  }, []);

  useEffect(() => {
    if (forceClosed) {
      setIsOpen(false);
    }
  }, [forceClosed]);

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
    if (!supportsHover && isTouch) setIsOpen((o) => !o);
  };

  // Determine whether to show tooltip based on environment and props
  const showTooltipDesktop =
    supportsHover && (alwaysShowTooltip === true || alwaysShowTooltip === 'desktop-only' || isTruncated);
  const showTooltipTouch =
    !supportsHover && isTouch && (alwaysShowTooltip === true || isTruncated);
  const shouldShowTooltip = showTooltipDesktop || showTooltipTouch;

  // Explicit styles for word breaking that preserve word integrity
  const wordBreakStyles: React.CSSProperties = {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    ...style,
  };

  // If not showing tooltip, render simple element
  if (!shouldShowTooltip) {
    return (
      <div
        ref={textRef}
        className={className}
        style={wordBreakStyles}
        onClick={onClick}
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

  // Wrap in tooltip when needed
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
