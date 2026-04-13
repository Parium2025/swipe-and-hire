import { useEffect, useRef, useCallback } from 'react';
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
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const isMobile = useIsMobile();

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

    // Adjust quality for mobile
    const dpr = isMobile ? 1.5 : 2;
    const samples = isMobile ? 12000 : 20000;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * 2,
      height: width * 2,
      phi: phiRef.current,
      theta: 0.25,
      dark: 1,
      diffuse: 3,
      mapSamples: samples,
      mapBrightness: 8,
      baseColor: [0.02, 0.08, 0.2],
      markerColor: [0.4, 0.8, 1],
      glowColor: [0.03, 0.12, 0.35],
      markers: [
        // Scandinavia — larger markers
        { location: [59.3293, 18.0686], size: 0.1 },   // Stockholm
        { location: [55.6761, 12.5683], size: 0.07 },  // Copenhagen
        { location: [59.9139, 10.7522], size: 0.07 },  // Oslo
        { location: [60.1699, 24.9384], size: 0.06 },  // Helsinki
        { location: [57.7089, 11.9746], size: 0.06 },  // Gothenburg
        { location: [55.604, 13.003], size: 0.05 },    // Malmö
        { location: [63.8258, 20.2630], size: 0.04 },  // Umeå
        { location: [67.8558, 20.2253], size: 0.04 },  // Kiruna
        // Europe
        { location: [51.5074, -0.1278], size: 0.05 },  // London
        { location: [48.8566, 2.3522], size: 0.05 },   // Paris
        { location: [52.52, 13.405], size: 0.05 },     // Berlin
        { location: [41.9028, 12.4964], size: 0.04 },  // Rome
        { location: [40.4168, -3.7038], size: 0.04 },  // Madrid
        { location: [50.0755, 14.4378], size: 0.03 },  // Prague
        { location: [47.4979, 19.0402], size: 0.03 },  // Budapest
        { location: [48.2082, 16.3738], size: 0.03 },  // Vienna
        { location: [52.2297, 21.0122], size: 0.03 },  // Warsaw
        // Global
        { location: [40.7128, -74.006], size: 0.04 },  // NYC
        { location: [35.6762, 139.6503], size: 0.04 }, // Tokyo
        { location: [1.3521, 103.8198], size: 0.03 },  // Singapore
        { location: [25.2048, 55.2708], size: 0.03 },  // Dubai
      ],
    });
    globeRef.current = globe;

    const animate = () => {
      if (pointerInteracting.current === null) {
        phiRef.current += 0.002;
      } else {
        phiRef.current += pointerDelta.current / 250;
        pointerDelta.current *= 0.92;
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
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
    <div className={`relative aspect-square ${className}`} aria-hidden="true">
      {/* Multi-layer glow for depth */}
      <div className="absolute inset-[-30%] rounded-full bg-[hsl(210_80%_20%/0.4)] blur-[100px]" />
      <div className="absolute inset-[-15%] rounded-full bg-[hsl(200_90%_40%/0.15)] blur-[80px]" />
      <div className="absolute inset-[-5%] rounded-full bg-[hsl(195_100%_50%/0.08)] blur-[50px]" />
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
