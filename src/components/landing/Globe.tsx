import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/**
 * NASA-style globe – extreme close-up from space, viewed at an angle.
 * The globe is scaled way up so you only see part of the sphere (the curvature),
 * giving the feeling of being in orbit looking down at Europe.
 * Bright city-lights style landmasses against dark oceans.
 */

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    const t0 = performance.now();

    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);

    const size = isMobile
      ? Math.min(Math.max(canvas.offsetWidth || 500, 500), 700)
      : Math.min(Math.max(canvas.offsetWidth || 800, 800), 1400);

    // cobe coordinate helpers
    const lonToPhi = (lon: number) => -(lon * Math.PI) / 180;
    const latToTheta = (lat: number) => (lat * Math.PI) / 180;

    // Journey: Mediterranean → Scandinavia
    const START_PHI = lonToPhi(12);     // Rome
    const START_THETA = latToTheta(38); // Mediterranean  
    const END_PHI = lonToPhi(16);       // Central Scandinavia
    const END_THETA = latToTheta(56);   // Scandinavia

    // Slow cinematic pan
    const panDuration = isMobile ? 10000 : 14000;

    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let currentPhi = START_PHI;
    let currentTheta = START_THETA;

    // Big scale = zoomed in, like a satellite view
    // Offset pushes the globe down so you see the curvature at the top
    const globeScale = isMobile ? 3.2 : 2.8;
    const globeOffset: [number, number] = isMobile ? [0, 280] : [0, 400];

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size,
      height: size,
      phi: currentPhi,
      theta: currentTheta,
      scale: globeScale,
      offset: globeOffset,
      dark: 1,
      diffuse: 3,
      mapSamples: isMobile ? 20000 : 32000,
      mapBrightness: 30,
      mapBaseBrightness: 0.05,
      baseColor: [0.01, 0.015, 0.05],    // Very dark ocean
      markerColor: [0.7, 0.9, 1],
      glowColor: [0.05, 0.15, 0.4],      // Subtle blue atmospheric edge
      markers: [],
      arcs: [],
      context: {
        antialias: !isMobile,
        alpha: true,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
        preserveDrawingBuffer: false,
      },
    });

    requestAnimationFrame(() => setReady(true));

    const animate = (now: number) => {
      if (document.hidden) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const elapsed = now - t0;

      if (elapsed < panDuration) {
        // Phase 1: slow cinematic drift from Med to Scandinavia
        const p = easeInOut(Math.min(elapsed / panDuration, 1));
        currentPhi = START_PHI + (END_PHI - START_PHI) * p;
        currentTheta = START_THETA + (END_THETA - START_THETA) * p;
      } else {
        // Phase 2: continuous slow NASA drift
        const post = (elapsed - panDuration) / 1000;
        currentPhi = END_PHI - post * 0.0004;
        currentTheta = END_THETA + Math.sin(post * 0.06) * 0.01;
      }

      globe.update({ phi: currentPhi, theta: currentTheta });
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
    };
  }, [isMobile]);

  return (
    <div
      className={`relative ${className}`}
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 2s cubic-bezier(0.22,1,0.36,1), transform 2.4s cubic-bezier(0.22,1,0.36,1)',
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
