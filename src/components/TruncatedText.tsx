import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTextProps {
  text: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Component that automatically detects if text is truncated and shows
 * a tooltip with the full text on hover
 */
export function TruncatedText({ text, className, children }: TruncatedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsTouch(typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
  }, []);

  useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current;
      if (!element) return;

      // More robust truncation detection using integer comparisons
      const truncated =
        Math.ceil(element.scrollHeight) > Math.ceil(element.clientHeight) ||
        Math.ceil(element.scrollWidth) > Math.ceil(element.clientWidth);

      setIsTruncated(truncated);
    };

    // Schedule checks to ensure layout/fonts are ready
    const raf = requestAnimationFrame(checkTruncation);
    const timeouts = [
      setTimeout(checkTruncation, 50),
      setTimeout(checkTruncation, 150),
      setTimeout(checkTruncation, 300),
    ];

    // Ensure after fonts load
    // @ts-ignore - document.fonts not in all TS lib targets
    document.fonts?.ready?.then(() => setTimeout(checkTruncation, 0));

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
    if (isTouch) setIsOpen((o) => !o);
  };

  if (!isTruncated) {
    // No truncation, just render the text normally
    return (
      <span ref={textRef} className={className}>
        {children || text}
      </span>
    );
  }

  // Text is truncated, wrap in tooltip
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={isTouch ? isOpen : undefined} onOpenChange={isTouch ? setIsOpen : undefined}>
        <TooltipTrigger asChild>
          <span ref={textRef} className={className} onClick={isTouch ? handleTap : undefined}>
            {children || text}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-md bg-white text-gray-900 border-gray-200 shadow-xl z-50"
        >
          <p className="text-sm leading-relaxed break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
