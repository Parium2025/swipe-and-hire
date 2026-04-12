import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import createGlobe from 'cobe';

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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef(-1.58);
  const thetaRef = useRef(0.42);
  const scaleRef = useRef(0.86);
  const pointerDownRef = useRef(false);
  const pointerXRef = useRef(0);
  const velocityRef = useRef(0);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const frameRef = useRef(0);
  const sizeRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [canvasSize, setCanvasSize] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const nextSize = Math.round(entry.contentRect.width);
      sizeRef.current = nextSize;
      setCanvasSize(nextSize);
    });

    intersectionObserver.observe(container);
    resizeObserver.observe(container);

    return () => {
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownRef.current = true;
    pointerXRef.current = e.clientX;
    canvasRef.current?.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e?: React.PointerEvent) => {
    pointerDownRef.current = false;

    if (e) {
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current || !canvasSize) return;

    const delta = (e.clientX - pointerXRef.current) / canvasSize;
    pointerXRef.current = e.clientX;
    velocityRef.current = delta * 0.72;
    phiRef.current += delta * 5.2;
  }, [canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible || !canvasSize) return;

    const compact = canvasSize < 560;
    const targetPhi = 0.18;
    const targetTheta = 0.34;
    const targetScale = compact ? 1.04 : 1.11;
    const introDuration = prefersReducedMotion ? 1 : 3200;
    const devicePixelRatio = clamp(window.devicePixelRatio, 1, compact ? 1.18 : 1.5);
    const samples = compact ? 10000 : canvasSize < 900 ? 16000 : 22000;
    const startTime = performance.now();

    globeRef.current?.destroy();

    const globe = createGlobe(canvas, {
      devicePixelRatio,
      width: canvasSize,
      height: canvasSize,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 2.45,
      mapSamples: samples,
      mapBrightness: 6.2,
      mapBaseBrightness: 0.02,
      baseColor: [0.01, 0.03, 0.08],
      markerColor: [0.2, 0.74, 1],
      glowColor: [0.05, 0.18, 0.38],
      opacity: 1,
      scale: scaleRef.current,
      markers,
    });

    globeRef.current = globe;

    const animate = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed < introDuration) {
        const t = elapsed / introDuration;
        const ease = 1 - Math.pow(1 - t, 4);
        phiRef.current = -1.58 + (targetPhi + 1.58) * ease;
        thetaRef.current = 0.42 + (targetTheta - 0.42) * ease;
        scaleRef.current = 0.86 + (targetScale - 0.86) * ease;
      } else if (!prefersReducedMotion) {
        if (!pointerDownRef.current) {
          phiRef.current += compact ? 0.00115 : 0.00075;
          phiRef.current += velocityRef.current;
          velocityRef.current *= 0.94;
        } else {
          velocityRef.current *= 0.9;
        }
      }

      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: scaleRef.current,
        width: canvasSize,
        height: canvasSize,
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      globe.destroy();
    };
  }, [canvasSize, isVisible, prefersReducedMotion]);

  return (
    <div ref={containerRef} className={`relative aspect-square isolate ${className}`} aria-hidden="true">
      <div className="landing-globe-halo absolute inset-[8%] rounded-full" />
      <div className="landing-globe-aura absolute inset-[-10%] rounded-full" />
      <div className="landing-orbit-ring landing-orbit-spin absolute inset-[-5%] rounded-full" />
      <div className="landing-orbit-ring landing-orbit-spin-reverse absolute inset-[-13%] rounded-full" />
      <div className="absolute inset-[-1.5%] rounded-full border border-[hsl(var(--landing-border)/0.14)]" />
      <div className="landing-drift absolute left-[12%] top-[22%] h-3 w-3 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_36px_hsl(var(--secondary)/0.55)]" />
      <div className="landing-drift absolute right-[13%] top-[30%] h-2.5 w-2.5 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_28px_hsl(var(--secondary)/0.48)] [animation-delay:-1.5s]" />
      <div className="landing-drift absolute bottom-[18%] left-[18%] h-2 w-2 rounded-full bg-[hsl(var(--pure-white))] shadow-[0_0_24px_hsl(var(--pure-white)/0.4)] [animation-delay:-3s]" />
      <div className="landing-drift absolute bottom-[26%] right-[8%] h-2 w-2 rounded-full bg-[hsl(var(--secondary))] shadow-[0_0_30px_hsl(var(--secondary)/0.48)] [animation-delay:-4.2s]" />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerMove={onPointerMove}
        className={`h-full w-full cursor-grab select-none transition-opacity duration-700 active:cursor-grabbing ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ contain: 'layout paint size', aspectRatio: '1 / 1', touchAction: 'pan-y' }}
      />
    </div>
  );
};

export default Globe;
