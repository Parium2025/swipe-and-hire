import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTextProps {
  text: string;
  className?: string;
  children?: React.ReactNode;
  alwaysShowTooltip?: boolean | 'desktop-only';
}

/**
 * Component that automatically detects if text is truncated and shows
 * a tooltip with the full text on hover
 */
export function TruncatedText({ text, className, children, alwaysShowTooltip }: TruncatedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
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

  const handleTap = () => {
    if (!supportsHover && isTouch) setIsOpen((o) => !o);
  };

  // Determine whether to show tooltip based on environment and props
  const showTooltipDesktop =
    supportsHover && (alwaysShowTooltip === true || alwaysShowTooltip === 'desktop-only' || isTruncated);
  const showTooltipTouch =
    !supportsHover && isTouch && (alwaysShowTooltip === true || isTruncated);
  const shouldShowTooltip = showTooltipDesktop || showTooltipTouch;

  if (!shouldShowTooltip) {
    // Render plain text without tooltip
    return (
      <span ref={textRef} className={className}>
        {children || text}
      </span>
    );
  }

  // Wrap in tooltip
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={!supportsHover ? isOpen : undefined} onOpenChange={!supportsHover ? setIsOpen : undefined}>
        <TooltipTrigger asChild>
          <span
            ref={textRef}
            className={`${className ?? ""} cursor-pointer pointer-events-auto`}
            onClick={!supportsHover && isTouch ? handleTap : undefined}
            onTouchStart={!supportsHover ? () => setIsOpen(true) : undefined}
          >
            {children || text}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-md bg-popover text-popover-foreground border border-border shadow-md z-50"
        >
          <p className="text-sm leading-relaxed break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
