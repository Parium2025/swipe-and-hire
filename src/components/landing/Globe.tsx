import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/**
 * NASA-style globe focused on Europe.
 * – Keeps the sphere shape (no cropping / rounded-full clipping)
 * – Starts looking at Italy / Mediterranean
 * – Slowly, continuously drifts northward toward Scandinavia
 * – After reaching Scandinavia it keeps a very slow gentle drift
 * – High-contrast bright landmasses on dark oceans (city-lights aesthetic)
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

    // Canvas pixel size – the container CSS controls visual size
    const size = isMobile
      ? Math.min(Math.max(canvas.offsetWidth || 380, 380), 500)
      : Math.min(Math.max(canvas.offsetWidth || 600, 600), 1000);

    // ── Coordinate helpers ──
    // cobe: phi = longitude rotation (radians), theta = latitude tilt (radians)
    // phi: 0 faces Africa/Europe.  Positive = rotate east (we want ~14-16° E)
    // theta: 0 = equator.  Positive = tilt north
    const lonToPhi = (lon: number) => -(lon * Math.PI) / 180;
    const latToTheta = (lat: number) => (lat * Math.PI) / 180;

    // Journey: Rome → Stockholm
    const START_PHI = lonToPhi(12);    // Rome longitude
    const START_THETA = latToTheta(42); // Rome latitude
    const END_PHI = lonToPhi(18);      // Stockholm longitude  
    const END_THETA = latToTheta(59);  // Stockholm latitude

    // Slow, cinematic pan – 12s on desktop, 8s on mobile
    const panDuration = isMobile ? 8000 : 12000;

    // Smooth ease
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let currentPhi = START_PHI;
    let currentTheta = START_THETA;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size,
      height: size,
      phi: currentPhi,
      theta: currentTheta,
      scale: 1.0,         // Normal scale – full sphere visible
      offset: [0, 0],
      dark: 1,
      diffuse: 2.5,
      mapSamples: isMobile ? 18000 : 28000,
      mapBrightness: 20,
      mapBaseBrightness: 0.08,
      baseColor: [0.01, 0.02, 0.06],     // Very dark ocean
      markerColor: [0.6, 0.9, 1],
      glowColor: [0.08, 0.24, 0.6],      // Blue atmospheric glow
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
        // Phase 1: slow cinematic pan from Italy to Scandinavia
        const p = easeInOut(Math.min(elapsed / panDuration, 1));
        currentPhi = START_PHI + (END_PHI - START_PHI) * p;
        currentTheta = START_THETA + (END_THETA - START_THETA) * p;
      } else {
        // Phase 2: continuous very slow rotation (NASA drift)
        const post = (elapsed - panDuration) / 1000; // seconds since intro ended
        // Slow continuous longitude rotation (~2° per minute)
        currentPhi = END_PHI - post * 0.0006;
        // Gentle latitude breathing
        currentTheta = END_THETA + Math.sin(post * 0.08) * 0.015;
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
