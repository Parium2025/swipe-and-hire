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

  useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current;
      if (!element) return;

      // Check if text is truncated by comparing scrollHeight with clientHeight
      // or scrollWidth with clientWidth
      const truncated = 
        element.scrollHeight > element.clientHeight ||
        element.scrollWidth > element.clientWidth;
      
      setIsTruncated(truncated);
    };

    // Check truncation on mount and when text changes
    checkTruncation();

    // Also check on resize
    const resizeObserver = new ResizeObserver(checkTruncation);
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span ref={textRef} className={className}>
            {children || text}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-md bg-white/95 text-gray-900 border-white/20 shadow-xl"
        >
          <p className="text-sm leading-relaxed">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
