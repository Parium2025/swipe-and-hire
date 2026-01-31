import { cn } from '@/lib/utils';

import type { CSSProperties } from 'react';

type PariumAuthLogoProps = {
  /** Full URL or path (e.g. /lovable-uploads/...) */
  src: string;
  /** Accessible label (announced via aria-label) */
  alt?: string;
  /** Controls visible size (set width + height via classes) */
  className?: string;
  /** Optional inline styles (useful for "first paint" sizing before CSS loads) */
  style?: CSSProperties;
};

/**
 * Auth logo renderer optimized for "always there" rendering:
 * - Visible layer uses backgroundImage (matches our GPU-warm preload strategy)
 * - Hidden <img> forces high-priority fetch + decode, without layout impact
 */
export function PariumAuthLogo({ src, alt = 'Parium', className, style }: PariumAuthLogoProps) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        'relative bg-center bg-no-repeat bg-contain pointer-events-none select-none transform-gpu will-change-transform',
        className
      )}
      style={{ contain: 'paint', ...(style ?? {}), backgroundImage: `url(${src})` }}
    >
      {/*
        Force fetch + decode with highest priority.
        Kept visually hidden so the painted result comes from the background layer.
      */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
