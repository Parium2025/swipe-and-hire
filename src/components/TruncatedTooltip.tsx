import { useRef, useState, useEffect, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TruncatedTooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export const TruncatedTooltip = ({ content, children, className }: TruncatedTooltipProps) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const checkTruncation = () => {
      // Check if content is truncated
      const isOverflowing = element.scrollWidth > element.clientWidth || 
                           element.scrollHeight > element.clientHeight;
      setIsTruncated(isOverflowing);
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    
    return () => window.removeEventListener('resize', checkTruncation);
  }, [content]);

  if (!isTruncated) {
    return <div ref={textRef} className={className}>{children}</div>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div ref={textRef} className={className}>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-white/95 backdrop-blur-sm border-white/20 text-gray-900 font-medium max-w-xs z-50">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
};
