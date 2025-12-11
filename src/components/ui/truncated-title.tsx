import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TruncatedTitleProps {
  children: ReactNode;
  fullText: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Renders text with automatic tooltip on hover - only when text is actually truncated.
 * Uses line-clamp detection to determine if tooltip should show.
 */
export function TruncatedTitle({ 
  children, 
  fullText, 
  className = "", 
  as: Component = "h3" 
}: TruncatedTitleProps) {
  const ref = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      const el = ref.current;
      if (!el) return;
      
      // Check if content overflows (scrollHeight > clientHeight means truncated)
      const truncated = el.scrollHeight > el.clientHeight + 2;
      setIsTruncated(truncated);
    };

    checkTruncation();
    
    // Re-check on resize
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkTruncation, 50);
    });
    
    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => resizeObserver.disconnect();
  }, [fullText, children]);

  const element = React.createElement(
    Component,
    { ref, className },
    children
  );

  if (!isTruncated) {
    return element;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {element}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        <p>{fullText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default TruncatedTitle;
