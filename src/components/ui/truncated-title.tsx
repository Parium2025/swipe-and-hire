import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [supportsHover, setSupportsHover] = useState(false);

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
      setSupportsHover(false);
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

    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [fullText, children]);

  const handleTap = () => {
    if (!supportsHover && isTouch) setIsOpen((o) => !o);
  };

  // Determine whether to show tooltip
  const showTooltipDesktop = supportsHover && isTruncated;
  const showTooltipTouch = !supportsHover && isTouch && isTruncated;
  const shouldShowTooltip = showTooltipDesktop || showTooltipTouch;

  if (!shouldShowTooltip) {
    return (
      <h3 ref={ref} className={className}>
        {children}
      </h3>
    );
  }

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={0}>
      <Tooltip 
        open={!supportsHover ? isOpen : undefined} 
        onOpenChange={!supportsHover ? setIsOpen : undefined}
      >
        <TooltipTrigger asChild>
          <h3
            ref={ref}
            className={`${className} cursor-pointer`}
            style={{ pointerEvents: 'auto' }}
            onClick={!supportsHover && isTouch ? handleTap : undefined}
            onTouchStart={!supportsHover ? () => setIsOpen(true) : undefined}
          >
            {children}
          </h3>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={10}
          onWheel={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="z-[99999] max-w-[300px] max-h-[200px] overflow-y-auto bg-slate-900/95 border-white/20 shadow-xl p-3"
        >
          <p className="text-sm text-white leading-relaxed break-words">{fullText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TruncatedTitle;
