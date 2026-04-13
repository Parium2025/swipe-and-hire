import { memo, useEffect, useRef, useMemo } from 'react';

interface GlobeProps {
  className?: string;
}

/**
 * Determine if it's currently "daytime" based on the user's local clock.
 * Uses civil twilight approximation: day = 06:00–20:00 local time.
 */
const isDaytime = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20;
};

/**
 * NASA Earth – circular globe mask with smooth upward pan.
 * Uses pre-cropped high-res imagery (8192px wide) focused on Europe (lat 25°–75°).
 * Automatically switches between Blue Marble (day) and Black Marble (night).
 */
const Globe = memo(({ className = '' }: GlobeProps) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDay = useMemo(() => isDaytime(), []);

  const imageSrc = isDay ? '/images/earth-day.jpg' : '/images/earth-night.jpg';

  // Eagerly decode both images so first paint is instant
  useEffect(() => {
    const preload = (src: string) => {
      const img = new Image();
      img.src = src;
      if ('decode' in img) img.decode().catch(() => {});
      return img;
    };
    imgRef.current = preload(imageSrc);
    preload(isDay ? '/images/earth-night.jpg' : '/images/earth-day.jpg');
  }, [imageSrc, isDay]);

  return (
    <div
      className={`${className} overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      {/* Earth image – pre-cropped to Europe, smooth upward drift */}
      <div
        className="absolute inset-0 animate-[earthPan_50s_linear_infinite]"
        style={{
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: '500% auto',
          backgroundPosition: '54% 100%',
          backgroundRepeat: 'repeat-y',
          filter: isDay
            ? 'brightness(1.05) contrast(1.1) saturate(1.15)'
            : 'brightness(1.6) contrast(1.2) saturate(1.2)',
          imageRendering: 'auto',
          willChange: 'background-position',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />

      {/* Circular globe mask – radial vignette creates sphere illusion */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDay
            ? `radial-gradient(circle 42% at 50% 52%, transparent 0%, transparent 55%, hsl(210 60% 8% / 0.3) 72%, hsl(210 60% 8% / 0.8) 88%, hsl(210 60% 8%) 100%)`
            : `radial-gradient(circle 42% at 50% 52%, transparent 0%, transparent 60%, hsl(215 100% 4% / 0.4) 75%, hsl(215 100% 4% / 0.85) 88%, hsl(215 100% 4%) 100%)`,
        }}
      />

      {/* Top fade to space/sky */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '25%',
          background: isDay
            ? 'linear-gradient(to bottom, hsl(210 60% 8%) 0%, hsl(210 60% 8% / 0.7) 40%, transparent 100%)'
            : 'linear-gradient(to bottom, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.7) 40%, transparent 100%)',
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '30%',
          background: isDay
            ? 'linear-gradient(to top, hsl(210 60% 8%) 0%, hsl(210 60% 8% / 0.6) 40%, transparent 100%)'
            : 'linear-gradient(to top, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.6) 40%, transparent 100%)',
        }}
      />
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
