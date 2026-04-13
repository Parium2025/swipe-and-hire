import { memo, useEffect, useRef } from 'react';

interface GlobeProps {
  className?: string;
}

/**
 * NASA Black Marble – circular globe mask with smooth upward pan.
 * Heavily zoomed into Europe (1200%) so the drift is cinematic.
 * Circular vignette creates sphere illusion.
 * Image is preloaded in index.html + eagerly decoded here for zero pop-in.
 */
const Globe = memo(({ className = '' }: GlobeProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Eagerly decode the earth image so the first paint is instant
  useEffect(() => {
    const img = new Image();
    img.src = '/images/earth-night.jpg';
    imgRef.current = img;
    if ('decode' in img) {
      img.decode().catch(() => {});
    }
  }, []);

  return (
    <div
      className={`${className} overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      {/* NASA Earth image – extreme zoom on Europe, smooth upward drift */}
      <div
        className="absolute inset-0 animate-[earthPan_45s_linear_infinite]"
        style={{
          backgroundImage: 'url(/images/earth-night.jpg)',
          backgroundSize: '1200% auto',
          backgroundPosition: '54% 18%',
          backgroundRepeat: 'repeat',
          filter: 'brightness(1.8) contrast(1.25) saturate(1.3)',
          imageRendering: 'auto',
          willChange: 'background-position',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
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
