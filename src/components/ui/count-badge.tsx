import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface CountBadgeProps {
  count: number;
  className?: string;
}

/**
 * Gemensam röd räknar-badge för chatt- och notisikonerna.
 *
 * Exakt samma storlek, form och färg överallt: 18×18 px cirkel som växer i
 * bredd först vid "9+". aspect-square + leading-none gör att den aldrig
 * blir oval på iOS/Android eller vid annan systemtextstorlek.
 *
 * Vid "9+" ändras aldrig texten även om något nytt kommit in. Därför gör
 * badgen en kort puls varje gång antalet ökar — man ser att något hänt
 * utan att siffran behöver ändras.
 */
export function CountBadge({ count, className }: CountBadgeProps) {
  const previous = useRef(count);
  const pulse = useRef(0);
  if (count > previous.current) pulse.current += 1;
  previous.current = count;

  if (!count || count <= 0) return null;

  return (
    <span
      key={pulse.current}
      aria-hidden="true"
      className={cn(
        'parium-badge-pop pointer-events-none select-none absolute -top-1 -right-1 z-20',
        'flex h-[18px] min-w-[18px] shrink-0 items-center justify-center',
        'rounded-full px-[3px] box-border',
        'bg-gradient-to-br from-red-400 to-red-600 text-white',
        'text-[10px] font-semibold leading-none tabular-nums',
        'shadow-lg shadow-red-500/30',
        className
      )}
    >
      <span className="parium-badge-ring" aria-hidden="true" />
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default CountBadge;
