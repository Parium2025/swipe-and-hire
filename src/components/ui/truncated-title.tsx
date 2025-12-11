import React, { useRef, useState, useEffect, ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface TruncatedTitleProps {
  children: ReactNode;
  fullText: string;
  className?: string;
}

/**
 * Renders text with automatic tooltip on hover - only when text is actually truncated.
 * Uses line-clamp detection to determine if tooltip should show.
 * Uses HoverCard instead of Tooltip for scrollable content support.
 */
export function TruncatedTitle({ 
  children, 
  fullText, 
  className = "", 
}: TruncatedTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      const el = ref.current;
      if (!el) return;
      
      // Check if content overflows (scrollHeight > clientHeight means truncated)
      const truncated = el.scrollHeight > el.clientHeight + 2;
      setIsTruncated(truncated);
    };

    // Initial check with slight delay to ensure rendering is complete
    const timer = setTimeout(checkTruncation, 100);
    
    // Re-check on resize
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkTruncation, 50);
    });
    
    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [fullText, children]);

  const element = (
    <h3 ref={ref} className={className}>
      {children}
    </h3>
  );

  if (!isTruncated) {
    return element;
  }

  return (
    <HoverCard openDelay={200} closeDelay={300}>
      <HoverCardTrigger asChild>
        {element}
      </HoverCardTrigger>
      <HoverCardContent 
        side="top" 
        sideOffset={8}
        avoidCollisions={false}
        className="z-[9999] max-w-[300px] max-h-[200px] overflow-y-auto pointer-events-auto bg-slate-900/95 border-white/20 text-white p-3"
      >
        <p className="text-sm">{fullText}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export default TruncatedTitle;
