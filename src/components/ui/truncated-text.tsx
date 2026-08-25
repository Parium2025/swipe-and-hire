import { TruncatedText as BaseTruncatedText } from '@/components/TruncatedText';
import { cn } from '@/lib/utils';

const isTouchOnly = () => {
  if (typeof window === 'undefined') return false;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hover =
    'matchMedia' in window
      ? window.matchMedia('(hover: hover)').matches || window.matchMedia('(pointer: fine)').matches
      : true;
  return touch && !hover;
};

const TOUCH_ONLY = isTouchOnly();

interface TruncatedTextProps {
  text: string;
  className?: string;
  /** Antal rader innan texten klipps. 1 = ellips på en rad. */
  lines?: 1 | 2 | 3;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Sätt till true när texten ligger i en klickbar rad/kort. På touch-enheter
   * renderas då enbart klippt text (utan tooltip), så att tryck alltid öppnar
   * raden i stället för att fånga upp en tooltip.
   */
  insideInteractive?: boolean;
}

/**
 * Tunn wrapper runt appens enda trunkeringskomponent (@/components/TruncatedText)
 * så att vi har EN källa till sanning för mätning, touch-stöd och tooltip-logik.
 * Texten fyller hela tillgänglig bredd och klipps först när den faktiskt inte får plats.
 */
export function TruncatedText({
  text,
  className,
  lines = 1,
  side = 'bottom',
  insideInteractive = false,
}: TruncatedTextProps) {
  const clampClass = lines === 1 ? 'truncate' : lines === 2 ? 'line-clamp-2' : 'line-clamp-3';

  if (insideInteractive && TOUCH_ONLY) {
    return <span className={cn('block w-full min-w-0', clampClass, className)}>{text}</span>;
  }

  return (
    <BaseTruncatedText
      text={text}
      lines={lines}
      tooltipSide={side}
      className={cn('block w-full min-w-0', className)}
    />
  );
}
