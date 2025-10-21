import React, { useRef, useState, useEffect, cloneElement, isValidElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTooltipProps {
  content: string;
  children: React.ReactElement;
  className?: string;
}

export const TruncatedTooltip: React.FC<TruncatedTooltipProps> = ({ content, children, className }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isFinePointer, setIsFinePointer] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: fine)');
    setIsFinePointer(mq ? mq.matches : true);
    const handler = () => setIsFinePointer(mq!.matches);
    mq?.addEventListener?.('change', handler);
    return () => mq?.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      // More aggressive check with smaller threshold
      const isHorizontallyTruncated = el.scrollWidth > el.clientWidth;
      const isVerticallyTruncated = el.scrollHeight > el.clientHeight;
      
      setIsTruncated(isHorizontallyTruncated || isVerticallyTruncated);
    };

    // Multiple checks to ensure we catch it
    const timer1 = setTimeout(check, 0);
    const timer2 = setTimeout(check, 100);
    const timer3 = setTimeout(check, 300);
    
    window.addEventListener('resize', check);
    const ro = new ResizeObserver(check);
    ro.observe(el);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', check);
      ro.disconnect();
    };
  }, [content]);

  if (!isValidElement(children)) return children as unknown as React.ReactElement;

  const childElement = children as React.ReactElement<any>;

  const setMergedRef = (node: HTMLElement | null) => {
    const childRef: any = (childElement as any).ref;
    if (typeof childRef === 'function') childRef(node);
    else if (childRef && typeof childRef === 'object') childRef.current = node;
    ref.current = node;
  };

  const childWithProps = cloneElement(childElement as any, {
    ref: setMergedRef as any,
    className: cn((childElement.props as any)?.className, className, isTruncated ? 'cursor-help' : ''),
  } as any);

  // Show tooltip if on fine pointer device and text is truncated
  if (!isFinePointer || !isTruncated) {
    return childWithProps;
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {childWithProps}
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="bg-white/95 backdrop-blur-sm border-white/20 text-gray-900 font-medium max-w-xs z-50"
        sideOffset={5}
      >
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
};
