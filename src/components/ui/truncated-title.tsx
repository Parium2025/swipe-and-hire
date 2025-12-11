import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTitleProps {
  children: ReactNode;
  fullText: string;
  className?: string;
}

/**
 * Renders text with automatic tooltip on hover - only when text is actually truncated.
 * Uses line-clamp detection to determine if tooltip should show.
 */
export function TruncatedTitle({ 
  children, 
  fullText, 
  className = "", 
}: TruncatedTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
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
      const element = ref.current;
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
        // Only consider truncated if natural height is significantly larger (more than 2px difference)
        truncated = naturalHeight > currentHeight + 2;
      } else {
        // For non-clamped elements, check if text actually overflows
        // Using a threshold of 2px to avoid false positives from rounding
        truncated =
          Math.ceil(element.scrollHeight) > Math.ceil(element.clientHeight) + 2 ||
          Math.ceil(element.scrollWidth) > Math.ceil(element.clientWidth) + 2;
      }

      setIsTruncated(truncated);
    };

    // Reset truncation state first
    setIsTruncated(false);

    // Run after a short delay to ensure proper rendering
    const initialTimeout = setTimeout(checkTruncation, 100);
    const secondTimeout = setTimeout(checkTruncation, 300);

    // Also check on resize of the element
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkTruncation, 50);
    });

    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
      resizeObserver.disconnect();
    };
  }, [fullText, children]);

  const handleTap = () => {
    if (!supportsHover && isTouch) setIsOpen((o) => !o);
  };

  // Stop propagation to prevent parent onClick from firing when interacting with tooltip
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supportsHover && isTouch) {
      handleTap();
    }
  };

  // Explicit styles for word breaking that preserve word integrity
  const wordBreakStyles: React.CSSProperties = {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  };

  // If not truncated, just return the element without tooltip wrapper
  if (!isTruncated) {
    return (
      <h3
        ref={ref}
        className={className}
        style={wordBreakStyles}
      >
        {children}
      </h3>
    );
  }

  // Wrap in tooltip when truncated
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
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </h3>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          avoidCollisions={false}
          className="z-[999999] max-w-[320px] max-h-[300px] overflow-y-auto overscroll-contain bg-slate-900/95 border border-white/20 shadow-2xl p-3 pointer-events-auto rounded-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
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
