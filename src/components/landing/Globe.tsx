import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/* cobe coordinate helpers */
const lonToPhi = (lon: number) => -Math.PI / 2 - (lon * Math.PI) / 180;
const latToTheta = (lat: number) => (lat * Math.PI) / 180;

/* Journey: start looking at southern Europe, slowly pan north to Scandinavia */
const START_PHI = lonToPhi(14);      // central Europe longitude
const START_THETA = latToTheta(38);   // Mediterranean
const END_PHI = lonToPhi(16);        // slightly east toward Stockholm
const END_THETA = latToTheta(60);    // Scandinavia

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    const t0 = performance.now();
    /* Longer pan duration so the upward scroll is clearly visible */
    const panDuration = isMobile ? 4000 : 5500;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.2);
    const size = isMobile
      ? Math.min(Math.max(canvas.offsetWidth || 340, 340), 440)
      : Math.min(Math.max(canvas.offsetWidth || 500, 500), 900);

    /* Extreme zoom: scale >2 crops away most of the sphere, showing only
       the Europe region like a satellite close-up */
    const globeScale = isMobile ? 2.8 : 2.4;

    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let phi = START_PHI;
    let theta = START_THETA;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size,
      height: size,
      phi,
      theta,
      scale: globeScale,
      offset: [0, 0],
      dark: 1,
      diffuse: 1.6,
      mapSamples: isMobile ? 14000 : 22000,
      mapBrightness: 12,
      mapBaseBrightness: 0.01,
      baseColor: [0.01, 0.02, 0.06],
      markerColor: [0.5, 0.85, 1],
      glowColor: [0.08, 0.28, 0.72],
      markers: [],
      arcs: [],
      context: {
        antialias: false,
        alpha: true,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
        preserveDrawingBuffer: false,
      },
    });

    requestAnimationFrame(() => setReady(true));

    const animate = (now: number) => {
      if (document.hidden) { raf = requestAnimationFrame(animate); return; }

      const elapsed = now - t0;

      if (elapsed < panDuration) {
        const p = easeInOut(Math.min(elapsed / panDuration, 1));
        phi = START_PHI + (END_PHI - START_PHI) * p;
        theta = START_THETA + (END_THETA - START_THETA) * p;
        globe.update({ phi, theta });
        raf = requestAnimationFrame(animate);
        return;
      }

      /* After pan: gentle breathing / subtle drift */
      const post = elapsed - panDuration;
      globe.update({
        phi: END_PHI + Math.sin(post * 0.00006) * 0.0015,
        theta: END_THETA + Math.sin(post * 0.00009) * 0.001,
      });
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(raf); globe.destroy(); };
  }, [isMobile]);

  return (
    <div
      className={`relative ${className}`}
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 1.8s cubic-bezier(0.22,1,0.36,1), transform 2s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full select-none"
        style={{ contain: 'layout paint size', aspectRatio: '1', display: 'block' }}
      />
    </div>
  );
};

export default Globe;
