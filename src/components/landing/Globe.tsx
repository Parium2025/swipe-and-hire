import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/**
 * Interactive dot-matrix globe focused on Scandinavia.
 * Uses cobe library for WebGL rendering.
 * Touch: drag to rotate. Desktop: drag + auto-rotate.
 */
const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const phiRef = useRef(0.25);
  const thetaRef = useRef(0.25);
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = e.clientX - pointerDelta.current;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  }, []);

  const onPointerUp = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const onPointerOut = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (pointerInteracting.current !== null) {
      pointerDelta.current = e.clientX - pointerInteracting.current;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame: number;
    let width = canvas.offsetWidth;
    let startTime = performance.now();

    const dpr = isMobile ? 1.5 : 2;
    const samples = isMobile ? 14000 : 24000;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * 2,
      height: width * 2,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 3.5,
      mapSamples: samples,
      mapBrightness: 10,
      baseColor: [0.015, 0.06, 0.18],
      markerColor: [0.3, 0.85, 1],
      glowColor: [0.02, 0.1, 0.4],
      markers: [
        // Scandinavia — larger markers
        { location: [59.3293, 18.0686], size: 0.12 },   // Stockholm
        { location: [55.6761, 12.5683], size: 0.08 },   // Copenhagen
        { location: [59.9139, 10.7522], size: 0.08 },   // Oslo
        { location: [60.1699, 24.9384], size: 0.07 },   // Helsinki
        { location: [57.7089, 11.9746], size: 0.07 },   // Gothenburg
        { location: [55.604, 13.003], size: 0.06 },     // Malmö
        { location: [63.8258, 20.2630], size: 0.05 },   // Umeå
        { location: [67.8558, 20.2253], size: 0.05 },   // Kiruna
        // Europe
        { location: [51.5074, -0.1278], size: 0.05 },
        { location: [48.8566, 2.3522], size: 0.05 },
        { location: [52.52, 13.405], size: 0.05 },
        { location: [41.9028, 12.4964], size: 0.04 },
        { location: [40.4168, -3.7038], size: 0.04 },
        { location: [50.0755, 14.4378], size: 0.03 },
        { location: [47.4979, 19.0402], size: 0.03 },
        { location: [48.2082, 16.3738], size: 0.03 },
        { location: [52.2297, 21.0122], size: 0.03 },
        // Global
        { location: [40.7128, -74.006], size: 0.04 },
        { location: [35.6762, 139.6503], size: 0.04 },
        { location: [1.3521, 103.8198], size: 0.03 },
        { location: [25.2048, 55.2708], size: 0.03 },
      ],
    });
    globeRef.current = globe;
    // Mark ready after first frame
    requestAnimationFrame(() => setReady(true));

    const animate = () => {
      const elapsed = performance.now() - startTime;

      if (pointerInteracting.current === null) {
        // Smooth slow rotation
        phiRef.current += 0.003;
        // Gentle theta oscillation for a "breathing" feel
        thetaRef.current = 0.25 + Math.sin(elapsed * 0.0003) * 0.03;
      } else {
        phiRef.current += pointerDelta.current / 250;
        pointerDelta.current *= 0.92;
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        width: width * 2,
        height: width * 2,
      });

      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      globe.destroy();
    };
  }, [isMobile]);

  return (
    <div
      className={`relative aspect-square ${className}`}
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? 'scale(1)' : 'scale(0.8)',
        transition: 'opacity 1.2s cubic-bezier(0.22,1,0.36,1), transform 1.4s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Multi-layer glow for depth */}
      <div className="absolute inset-[-35%] rounded-full bg-[hsl(210_80%_22%/0.5)] blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute inset-[-20%] rounded-full bg-[hsl(200_90%_40%/0.18)] blur-[90px]" />
      <div className="absolute inset-[-8%] rounded-full bg-[hsl(195_100%_50%/0.1)] blur-[60px]" />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onMouseMove={onMouseMove}
        className="w-full h-full cursor-grab select-none"
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
