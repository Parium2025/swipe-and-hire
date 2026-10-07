import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTruncationTooltip } from '@/hooks/useTruncationTooltip';

interface TruncatedTooltipProps {
  /** Texten som visas i triggern och i rutan. */
  text: string;
  /** Klasser för triggern, inklusive dess kapning (`truncate` eller `line-clamp-*`). */
  className?: string;
  contentClassName?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delayDuration?: number;
  as?: 'span' | 'p' | 'div';
  /** Valfritt innehåll i rutan. Utan detta visas `text` i en vanlig paragraf. */
  children?: React.ReactNode;
}

/**
 * Tooltip som endast öppnas när texten faktiskt är kapad. Används överallt i
 * appen där en trunkerad rubrik eller ett namn ska kunna läsas i sin helhet —
 * text som får plats får ingen tooltip alls.
 */
export function TruncatedTooltip({
  text,
  className,
  contentClassName,
  side = 'top',
  delayDuration = 200,
  as = 'span',
  children,
}: TruncatedTooltipProps) {
  const { ref, open, onOpenChange } = useTruncationTooltip<HTMLElement>();
  const Tag = as;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={open} onOpenChange={onOpenChange}>
        <TooltipTrigger asChild>
          <Tag ref={ref as React.Ref<any>} className={className}>
            {text}
          </Tag>
        </TooltipTrigger>
        <TooltipContent side={side} className={contentClassName}>
          {children ?? <p>{text}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
