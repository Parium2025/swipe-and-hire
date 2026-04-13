import { memo } from 'react';

interface GlobeProps {
  className?: string;
}

/**
 * NASA Black Marble – circular globe mask with slow upward pan.
 * Heavily zoomed into Europe (1200%) so the drift is very slow.
 * Circular vignette makes it look like a sphere, not a flat map.
 */
const Globe = memo(({ className = '' }: GlobeProps) => {
  return (
    <div
      className={`${className} overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      {/* NASA Earth image – extreme zoom on Europe, very slow upward drift */}
      <div
        className="absolute inset-0 animate-[earthPan_90s_linear_infinite]"
        style={{
          backgroundImage: 'url(/images/earth-night.jpg)',
          backgroundSize: '1200% auto',
          backgroundPosition: '54% 20%',
          backgroundRepeat: 'repeat',
          filter: 'brightness(1.8) contrast(1.25) saturate(1.3)',
          imageRendering: 'auto',
        }}
      />

      {/* Circular globe mask – strong radial vignette creates sphere illusion */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle 42% at 50% 52%, transparent 0%, transparent 60%, hsl(215 100% 4% / 0.4) 75%, hsl(215 100% 4% / 0.85) 88%, hsl(215 100% 4%) 100%)
          `,
        }}
      />

      {/* Top fade to space */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '25%',
          background: 'linear-gradient(to bottom, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.7) 40%, transparent 100%)',
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '30%',
          background: 'linear-gradient(to top, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.6) 40%, transparent 100%)',
        }}
      />
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
