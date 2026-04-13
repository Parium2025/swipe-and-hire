import { memo } from 'react';

interface GlobeProps {
  className?: string;
}

/**
 * NASA Black Marble (Earth at Night) – high-res 13500x6750 equirectangular.
 * 
 * Equirectangular projection mapping:
 *   X: 0% = 180°W (Pacific), 50% = 0° (Greenwich), 100% = 180°E
 *   Y: 0% = 90°N (North Pole), 50% = Equator, 100% = 90°S
 * 
 * Europe center (~15°E, ~50°N):
 *   X = 50% + (15/360)*100% ≈ 54%
 *   Y = (90-50)/180*100% ≈ 22%
 * 
 * Italy (~12°E, ~42°N):  X≈53%, Y≈27%
 * Scandinavia (~15°E, ~60°N): X≈54%, Y≈17%
 */
const Globe = memo(({ className = '' }: GlobeProps) => {
  return (
    <div
      className={`${className} overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      {/* NASA Earth at night – zoomed tight on Europe, scrolls upward continuously */}
      <div
        className="absolute inset-0 animate-[earthPan_45s_linear_infinite]"
        style={{
          backgroundImage: 'url(/images/earth-night.jpg)',
          backgroundSize: '900% auto',
          backgroundPosition: '54% 18%',
          backgroundRepeat: 'repeat',
          filter: 'brightness(1.8) contrast(1.25) saturate(1.3)',
          imageRendering: 'auto',
        }}
      />

      {/* Radial vignette for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 20%, hsl(215 100% 4% / 0.6) 80%, hsl(215 100% 4% / 0.95) 100%)',
        }}
      />

      {/* Top fade – simulates looking into space above Earth */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '30%',
          background: 'linear-gradient(to bottom, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.6) 50%, transparent 100%)',
        }}
      />

      {/* Bottom fade – blend into page */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '35%',
          background: 'linear-gradient(to top, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.5) 40%, transparent 100%)',
        }}
      />
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
