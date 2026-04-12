import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef(-0.8);
  const thetaRef = useRef(0.1);
  const scaleRef = useRef(0.75);
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const startTime = useRef(Date.now());
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
    if (!canvas || !isVisible) return;

    let animationFrame: number;
    let width = canvas.offsetWidth;
    startTime.current = Date.now();

    const dpr = isMobile ? 1.5 : 2;
    const samples = isMobile ? 16000 : 28000;

    const targetPhi = 0.25;
    const introSeconds = 4;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * 2,
      height: width * 2,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 4,
      mapSamples: samples,
      mapBrightness: 12,
      mapBaseBrightness: 0.03,
      baseColor: [0.01, 0.05, 0.15],
      markerColor: [0.3, 0.8, 1],
      glowColor: [0.02, 0.08, 0.25],
      scale: scaleRef.current,
      markers: [
        // Scandinavia — prominent
        { location: [59.3293, 18.0686], size: 0.14 },  // Stockholm ★
        { location: [55.6761, 12.5683], size: 0.09 },  // Copenhagen
        { location: [59.9139, 10.7522], size: 0.09 },  // Oslo
        { location: [60.1699, 24.9384], size: 0.08 },  // Helsinki
        { location: [57.7089, 11.9746], size: 0.08 },  // Gothenburg
        { location: [55.604, 13.003], size: 0.07 },    // Malmö
        { location: [63.8258, 20.2630], size: 0.05 },  // Umeå
        { location: [67.8558, 20.2253], size: 0.04 },  // Kiruna
        { location: [61.4978, 23.761], size: 0.04 },   // Tampere
        { location: [56.1629, 10.2039], size: 0.04 },  // Aarhus
        // Europe
        { location: [51.5074, -0.1278], size: 0.06 },  // London
        { location: [48.8566, 2.3522], size: 0.06 },   // Paris
        { location: [52.52, 13.405], size: 0.06 },     // Berlin
        { location: [41.9028, 12.4964], size: 0.04 },  // Rome
        { location: [40.4168, -3.7038], size: 0.04 },  // Madrid
        { location: [50.0755, 14.4378], size: 0.03 },  // Prague
        { location: [52.3676, 4.9041], size: 0.04 },   // Amsterdam
        { location: [47.3769, 8.5417], size: 0.03 },   // Zurich
        // Global
        { location: [40.7128, -74.006], size: 0.05 },  // NYC
        { location: [37.7749, -122.4194], size: 0.04 },// SF
        { location: [35.6762, 139.6503], size: 0.04 }, // Tokyo
        { location: [1.3521, 103.8198], size: 0.03 },  // Singapore
        { location: [25.2048, 55.2708], size: 0.03 },  // Dubai
        { location: [-33.8688, 151.2093], size: 0.03 },// Sydney
      ],
    });

    const animate = () => {
      const elapsed = (Date.now() - startTime.current) / 1000;

      if (elapsed < introSeconds) {
        const t = elapsed / introSeconds;
        const ease = 1 - Math.pow(1 - t, 4);

        phiRef.current = -0.8 + (targetPhi + 0.8) * ease;
        thetaRef.current = 0.1 + 0.15 * ease;
        scaleRef.current = 0.75 + 0.25 * ease;
      } else {
        if (pointerInteracting.current === null) {
          phiRef.current += 0.0008;
        } else {
          phiRef.current += pointerDelta.current / 300;
          pointerDelta.current *= 0.9;
        }
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: scaleRef.current,
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
  }, [isMobile, isVisible]);

  return (
    <div ref={containerRef} className={`relative aspect-square ${className}`} aria-hidden="true">
      {/* Atmospheric glow layers */}
      <div className="absolute inset-[-50%] rounded-full bg-[hsl(210_80%_15%/0.4)] blur-[140px] animate-pulse" style={{ animationDuration: '5s' }} />
      <div className="absolute inset-[-30%] rounded-full bg-[hsl(195_90%_30%/0.12)] blur-[100px]" />
      <div className="absolute inset-[-15%] rounded-full bg-[hsl(190_100%_45%/0.06)] blur-[70px]" />

      {/* Orbiting rings */}
      <div className="absolute inset-[-8%] rounded-full border border-white/[0.03] animate-[spin_70s_linear_infinite]" />
      <div className="absolute inset-[-16%] rounded-full border border-white/[0.015] animate-[spin_100s_linear_infinite_reverse]" />

      {/* Floating particles - desktop only */}
      {!isMobile && (
        <>
          <div className="absolute w-1 h-1 rounded-full bg-secondary/50 top-[8%] right-[18%] animate-[float_6s_ease-in-out_infinite]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-accent/30 top-[22%] left-[12%] animate-[float_8s_ease-in-out_infinite_-2s]" />
          <div className="absolute w-1 h-1 rounded-full bg-secondary/40 bottom-[25%] right-[8%] animate-[float_7s_ease-in-out_infinite_-4s]" />
          <div className="absolute w-0.5 h-0.5 rounded-full bg-white/20 top-[45%] left-[8%] animate-[float_5s_ease-in-out_infinite_-1s]" />
          <div className="absolute w-1 h-1 rounded-full bg-secondary/30 bottom-[12%] left-[22%] animate-[float_9s_ease-in-out_infinite_-3s]" />
        </>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onMouseMove={onMouseMove}
        className={`w-full h-full cursor-grab select-none transition-opacity duration-1500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
