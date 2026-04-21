import React, { useRef, useState, useEffect, useCallback, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTitleProps {
  children: ReactNode;
  fullText: string;
  className?: string;
  style?: React.CSSProperties;
  side?: "top" | "right" | "bottom" | "left";
}

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
 * Lazy-measuring truncated title. Same perf model as TruncatedText:
 * no DOM cloning, no eager reflow — measure only on hover/touch/focus.
 */
export function TruncatedTitle({
  children,
  fullText,
  className = "",
  style,
  side = "top",
}: TruncatedTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { isTouch, supportsHover } = ENV;

  // Reset measurement when text changes
  useEffect(() => {
    setHasMeasured(false);
    setIsTruncated(false);
  }, [fullText]);

  const measureTruncation = useCallback(() => {
    if (hasMeasured) return;
    const element = ref.current;
    if (!element) return;

    const styles = window.getComputedStyle(element);
    const webkitLineClamp = (styles.getPropertyValue("-webkit-line-clamp") || "").trim();
    const hasClamp = webkitLineClamp !== "" && webkitLineClamp !== "none";

    let truncated = false;
    if (hasClamp) {
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

  const handleTap = () => {
    if (!supportsHover && isTouch) {
      measureTruncation();
      setIsOpen((o) => !o);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supportsHover && isTouch) handleTap();
  };

  const handleMouseEnter = () => {
    if (supportsHover) measureTruncation();
  };

  const wordBreakStyles: React.CSSProperties = {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    ...style,
  };

  if (!isTruncated) {
    return (
      <h3
        ref={ref}
        className={className}
        style={wordBreakStyles}
        onMouseEnter={handleMouseEnter}
        onTouchStart={isTouch && !supportsHover ? measureTruncation : undefined}
        onFocus={measureTruncation}
        title={hasMeasured ? undefined : fullText}
      >
        {children}
      </h3>
    );
  }

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100} disableHoverableContent={false}>
      <Tooltip
        open={!supportsHover ? isOpen : undefined}
        onOpenChange={!supportsHover ? setIsOpen : undefined}
        disableHoverableContent={false}
      >
        <TooltipTrigger asChild>
          <h3
            ref={ref}
            className={`${className} cursor-pointer pointer-events-auto`}
            style={wordBreakStyles}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </h3>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={8}
          avoidCollisions={false}
          allowOutsidePointerEvents
          className="z-[999999] max-w-[min(90vw,600px)] max-h-[300px] overflow-y-auto overscroll-contain bg-slate-900/95 border border-white/20 shadow-2xl p-3 pointer-events-auto rounded-lg"
          onPointerDownOutside={() => setIsOpen(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-white leading-relaxed break-words whitespace-pre-wrap">{fullText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TruncatedTitle;
