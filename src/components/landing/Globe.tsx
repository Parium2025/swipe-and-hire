import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/**
 * Immersive zoomed-in globe showing Scandinavia/Europe as a horizon.
 * Creates a cinematic "planet surface" effect rather than a small ball.
 */
const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0.3);
  const thetaRef = useRef(0.35);
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
    const startTime = performance.now();

    const dpr = isMobile ? 1.5 : 2;
    const samples = isMobile ? 16000 : 28000;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: width * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 3,
      mapSamples: samples,
      mapBrightness: 8,
      baseColor: [0.02, 0.06, 0.15],
      markerColor: [0.3, 0.85, 1],
      glowColor: [0.03, 0.12, 0.4],
      markers: [
        // Scandinavia
        { location: [59.3293, 18.0686], size: 0.14 },
        { location: [55.6761, 12.5683], size: 0.1 },
        { location: [59.9139, 10.7522], size: 0.1 },
        { location: [60.1699, 24.9384], size: 0.08 },
        { location: [57.7089, 11.9746], size: 0.08 },
        { location: [55.604, 13.003], size: 0.07 },
        { location: [63.8258, 20.2630], size: 0.06 },
        { location: [67.8558, 20.2253], size: 0.05 },
        // Europe
        { location: [51.5074, -0.1278], size: 0.06 },
        { location: [48.8566, 2.3522], size: 0.06 },
        { location: [52.52, 13.405], size: 0.06 },
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

    requestAnimationFrame(() => setReady(true));

    const animate = () => {
      const elapsed = performance.now() - startTime;

      if (pointerInteracting.current === null) {
        phiRef.current += 0.002;
        thetaRef.current = 0.35 + Math.sin(elapsed * 0.00025) * 0.04;
      } else {
        phiRef.current += pointerDelta.current / 300;
        pointerDelta.current *= 0.92;
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        width: width * dpr,
        height: width * dpr,
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
      className={`relative ${className}`}
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 1.5s cubic-bezier(0.22,1,0.36,1), transform 1.8s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Atmospheric glow layers */}
      <div className="absolute inset-[-40%] rounded-full bg-[hsl(210_80%_18%/0.6)] blur-[150px] animate-pulse" style={{ animationDuration: '5s' }} />
      <div className="absolute inset-[-25%] rounded-full bg-[hsl(200_90%_35%/0.2)] blur-[100px]" />
      <div className="absolute inset-[-10%] rounded-full bg-[hsl(195_100%_50%/0.08)] blur-[70px]" />
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
