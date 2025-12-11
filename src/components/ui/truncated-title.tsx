import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTitleProps {
  children: ReactNode;
  fullText: string;
  className?: string;
  alwaysShowTooltip?: boolean | "desktop-only";
}

/**
 * Renders text with automatic tooltip on hover - only when text is actually truncated.
 * Uses line-clamp detection to determine if tooltip should show.
 */
export function TruncatedTitle({ 
  children, 
  fullText, 
  className = "", 
  alwaysShowTooltip = false,
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

      // Get computed styles
      const styles = window.getComputedStyle(element);
      const webkitLineClamp = (styles.getPropertyValue("-webkit-line-clamp") || "").trim();
      const hasClamp = webkitLineClamp !== "" && webkitLineClamp !== "none";

      let truncated = false;
      
      if (hasClamp) {
        // For line-clamp: clone element to measure natural height
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.cssText = `
          position: absolute;
          visibility: hidden;
          pointer-events: none;
          -webkit-line-clamp: unset;
          display: block;
          max-height: none;
          overflow: visible;
          width: ${element.clientWidth}px;
        `;
        document.body.appendChild(clone);
        const naturalHeight = clone.scrollHeight;
        document.body.removeChild(clone);
        const currentHeight = element.clientHeight;
        // Need significant difference (more than 4px) to be considered truncated
        truncated = naturalHeight > currentHeight + 4;
      } else {
        // For non-clamped: check if content overflows
        // Text must overflow by at least 4px to be considered truncated
        truncated =
          element.scrollHeight > element.clientHeight + 4 ||
          element.scrollWidth > element.clientWidth + 4;
      }

      setIsTruncated(truncated);
    };

    // Start with false
    setIsTruncated(false);

    // Check after render is complete
    const timeoutId = setTimeout(checkTruncation, 150);
    
    // Also observe resize
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkTruncation, 50);
    });

    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [fullText, children]);

  const handleTap = () => {
    if (!supportsHover && isTouch) setIsOpen((o) => !o);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supportsHover && isTouch) {
      handleTap();
    }
  };

  const wordBreakStyles: React.CSSProperties = {
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  };

  // Determine if we should show tooltip
  const shouldShowTooltipDesktop = alwaysShowTooltip === true || alwaysShowTooltip === "desktop-only";
  const showTooltip = isTruncated || (supportsHover && shouldShowTooltipDesktop);

  if (!showTooltip) {
    return (
      <h3 ref={ref} className={className} style={wordBreakStyles}>
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
