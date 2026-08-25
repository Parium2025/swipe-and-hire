import { TruncatedText as BaseTruncatedText } from '@/components/TruncatedText';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  className?: string;
  /** Antal rader innan texten klipps. 1 = ellips på en rad. */
  lines?: 1 | 2 | 3;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Tunn wrapper runt appens enda trunkeringskomponent (@/components/TruncatedText)
 * så att vi har EN källa till sanning för mätning, touch-stöd och tooltip-logik.
 * Texten fyller hela tillgänglig bredd och klipps först när den faktiskt inte får plats.
 */
export function TruncatedText({ text, className, lines = 1, side = 'bottom' }: TruncatedTextProps) {
  return (
    <BaseTruncatedText
      text={text}
      lines={lines}
      tooltipSide={side}
      className={cn('block w-full min-w-0', className)}
    />
  );
}
