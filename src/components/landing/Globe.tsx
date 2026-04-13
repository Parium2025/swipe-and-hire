import { memo } from 'react';

interface GlobeProps {
  className?: string;
}

/**
 * NASA Earth-at-night image with CSS animation.
 * The image is an equirectangular projection. We show a cropped portion
 * (Europe) and slowly pan upward from Italy to Scandinavia using CSS
 * keyframe animation. Pure CSS – no WebGL, works perfectly on all devices.
 */
const Globe = memo(({ className = '' }: GlobeProps) => {
  return (
    <div
      className={`${className} overflow-hidden`}
      aria-hidden="true"
      style={{ position: 'relative' }}
    >
      {/* The NASA image, cropped to Europe via object-position animation */}
      <div
        className="absolute inset-0 animate-[earthPan_16s_cubic-bezier(0.4,0,0.2,1)_forwards]"
        style={{
          backgroundImage: 'url(/images/earth-night.jpg)',
          backgroundSize: '400% 400%',
          /* Start position: Southern Europe / Mediterranean */
          backgroundPosition: '62% 48%',
          filter: 'brightness(1.4) contrast(1.15) saturate(1.2)',
        }}
      />

      {/* Subtle blue atmospheric glow at the edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 60%, transparent 30%, hsl(215 100% 6% / 0.7) 100%)',
        }}
      />

      {/* Curved horizon effect – gradient at the top simulating Earth's atmosphere */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '35%',
          background: 'linear-gradient(to bottom, hsl(215 100% 4% / 0.95) 0%, hsl(210 80% 8% / 0.3) 60%, transparent 100%)',
        }}
      />

      {/* Bottom fade to blend into page background */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '40%',
          background: 'linear-gradient(to top, hsl(215 100% 4%) 0%, hsl(215 100% 4% / 0.6) 40%, transparent 100%)',
        }}
      />
    </div>
  );
});

Globe.displayName = 'Globe';

export default Globe;
