import { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type BorderBeamProps = {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
};

/**
 * Animated beam of light that travels along the border of its parent container.
 * Parent must be `relative` and `overflow-hidden`. Pure CSS — no JS, no deps.
 */
export const BorderBeam = ({
  className,
  size = 240,
  duration = 8,
  delay = 0,
  colorFrom = 'hsl(var(--secondary))',
  colorTo = 'hsl(var(--secondary) / 0)',
  borderWidth = 1.5,
}: BorderBeamProps) => {
  return (
    <div
      style={
        {
          '--bb-size': `${size}px`,
          '--bb-duration': `${duration}s`,
          '--bb-delay': `${delay}s`,
          '--bb-border-width': `${borderWidth}px`,
          '--bb-color-from': colorFrom,
          '--bb-color-to': colorTo,
        } as CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        '[mask-clip:padding-box,border-box]',
        '[mask-composite:intersect]',
        '[mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]',
        'after:absolute after:aspect-square after:w-[var(--bb-size)]',
        'after:animate-[border-beam_var(--bb-duration)_linear_infinite]',
        'after:[animation-delay:var(--bb-delay)]',
        'after:[offset-anchor:90%_50%]',
        'after:[offset-path:rect(0_auto_auto_0_round_var(--bb-size))]',
        'after:[background:linear-gradient(to_left,var(--bb-color-from),var(--bb-color-to))]',
        'border-[length:var(--bb-border-width)] border-transparent',
        className,
      )}
      aria-hidden
    />
  );
};

export default BorderBeam;
