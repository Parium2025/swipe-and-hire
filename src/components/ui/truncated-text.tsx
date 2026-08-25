import { useCallback, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  className?: string;
  /** Antal rader innan texten klipps. 1 = ellips på en rad. */
  lines?: 1 | 2 | 3;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Visar text som fyller hela sin tillgängliga bredd och klipps först när den
 * faktiskt inte får plats. Tooltip öppnas endast vid verklig trunkering, så
 * det aldrig dyker upp en onödig tooltip när texten redan syns i sin helhet.
 */
export function TruncatedText({ text, className, lines = 1, side = 'bottom' }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const truncated =
      el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    if (truncated) setOpen(true);
  }, []);

  const clampClass =
    lines === 1 ? 'truncate' : lines === 2 ? 'line-clamp-2' : 'line-clamp-3';

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          className={cn('block w-full min-w-0 cursor-default', clampClass, className)}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[min(20rem,80vw)]">
        <p className="text-sm break-words">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
