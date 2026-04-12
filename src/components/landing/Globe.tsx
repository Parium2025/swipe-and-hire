import { useEffect, useRef, useCallback, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const markers: Array<{ location: [number, number]; size: number }> = [
  { location: [59.3293, 18.0686], size: 0.18 },
  { location: [57.7089, 11.9746], size: 0.11 },
  { location: [55.604, 13.003], size: 0.1 },
  { location: [59.9139, 10.7522], size: 0.11 },
  { location: [55.6761, 12.5683], size: 0.11 },
  { location: [60.1699, 24.9384], size: 0.1 },
  { location: [63.8258, 20.263], size: 0.08 },
  { location: [65.5848, 22.1547], size: 0.06 },
  { location: [67.8558, 20.2253], size: 0.05 },
  { location: [61.4978, 23.761], size: 0.07 },
  { location: [56.1629, 10.2039], size: 0.06 },
  { location: [51.5074, -0.1278], size: 0.08 },
  { location: [52.52, 13.405], size: 0.08 },
  { location: [48.8566, 2.3522], size: 0.08 },
  { location: [52.3676, 4.9041], size: 0.06 },
  { location: [50.1109, 8.6821], size: 0.06 },
  { location: [50.0755, 14.4378], size: 0.05 },
  { location: [47.3769, 8.5417], size: 0.05 },
  { location: [48.2082, 16.3738], size: 0.05 },
  { location: [41.9028, 12.4964], size: 0.05 },
  { location: [40.4168, -3.7038], size: 0.05 },
  { location: [40.7128, -74.006], size: 0.05 },
  { location: [37.7749, -122.4194], size: 0.04 },
  { location: [1.3521, 103.8198], size: 0.04 },
  { location: [35.6762, 139.6503], size: 0.04 },
];

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef(-1.15);
  const thetaRef = useRef(0.28);
  const scaleRef = useRef(1.02);
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const startTime = useRef(Date.now());
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerInteracting.current !== null) {
      pointerDelta.current = e.clientX - pointerInteracting.current;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    let animationFrame = 0;
    let size = canvas.offsetWidth;
    startTime.current = Date.now();

    const dpr = isMobile ? 1.15 : 1.35;
    const samples = isMobile ? 12000 : 18000;
    const introSeconds = prefersReducedMotion ? 0.01 : 4.5;
    const targetPhi = 0.16;
    const targetTheta = 0.33;
    const targetScale = isMobile ? 1.03 : 1.08;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size,
      height: size,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 2.6,
      mapSamples: samples,
      mapBrightness: 7,
      mapBaseBrightness: 0.02,
      baseColor: [0.015, 0.03, 0.08],
      markerColor: [0.25, 0.77, 1],
      glowColor: [0.04, 0.16, 0.34],
      opacity: 1,
      scale: scaleRef.current,
      markers,
    });

    const animate = () => {
      const elapsed = (Date.now() - startTime.current) / 1000;

      if (elapsed < introSeconds) {
        const t = elapsed / introSeconds;
        const ease = 1 - Math.pow(1 - t, 4);
        phiRef.current = -1.15 + (targetPhi + 1.15) * ease;
        thetaRef.current = 0.28 + (targetTheta - 0.28) * ease;
        scaleRef.current = 0.92 + (targetScale - 0.92) * ease;
      } else if (!prefersReducedMotion) {
        if (pointerInteracting.current === null) {
          phiRef.current += isMobile ? 0.0011 : 0.00085;
        } else {
          phiRef.current += pointerDelta.current * 0.0017;
          pointerDelta.current *= 0.92;
        }
      }

      size = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: scaleRef.current,
        width: size,
        height: size,
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      globe.destroy();
    };
  }, [isMobile, isVisible, prefersReducedMotion]);

  return (
    <div ref={containerRef} className={`relative aspect-square isolate ${className}`} aria-hidden="true">
      <div className="absolute inset-[-18%] rounded-full bg-secondary/10 blur-[140px]" />
      <div className="absolute inset-[-8%] rounded-full bg-accent/8 blur-[80px]" />
      <div className="absolute inset-[-2%] rounded-full border border-white/[0.05]" />
      <div className="absolute inset-[-10%] rounded-full border border-white/[0.04] animate-[spin_100s_linear_infinite]" />
      <div className="absolute inset-[-18%] rounded-full border border-white/[0.03] animate-[spin_130s_linear_infinite_reverse]" />
      {!isMobile && (
        <>
          <div className="absolute top-[14%] left-[12%] h-1.5 w-1.5 rounded-full bg-secondary animate-[float_7s_ease-in-out_infinite]" />
          <div className="absolute top-[30%] right-[10%] h-2 w-2 rounded-full bg-accent animate-[float_9s_ease-in-out_infinite_-2s]" />
          <div className="absolute bottom-[18%] left-[16%] h-1 w-1 rounded-full bg-white/60 animate-[float_8s_ease-in-out_infinite_-1s]" />
          <div className="absolute top-[52%] right-[6%] h-1.5 w-1.5 rounded-full bg-secondary animate-[float_10s_ease-in-out_infinite_-4s]" />
        </>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerMove={onPointerMove}
        className={`h-full w-full cursor-grab select-none transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ contain: 'layout paint size', aspectRatio: '1 / 1' }}
      />
    </div>
  );
};

export default Globe;
