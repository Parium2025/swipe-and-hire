import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // phi = longitude rotation in cobe. ~1.8 rad centers on Europe/Scandinavia
  const phiRef = useRef(1.8);
  const thetaRef = useRef(0.55);
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

    // Cinematic pan: start looking at Italy (theta ~0.55), pan up to Scandinavia (theta ~0.35)
    // over ~6 seconds, then gently breathe
    const INTRO_DURATION = 6000; // ms
    const THETA_START = 0.55; // Italy region
    const THETA_END = 0.35;   // Scandinavia region

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: width * dpr,
      phi: 0.3,
      theta: THETA_START,
      dark: 1,
      diffuse: 6,
      mapSamples: isMobile ? 20000 : 40000,
      mapBrightness: 20,
      baseColor: [0.05, 0.1, 0.25],
      markerColor: [0.4, 0.9, 1],
      glowColor: [0.08, 0.2, 0.6],
      markers: [], // No markers – clean look
    });

    requestAnimationFrame(() => setReady(true));

    // Easing: cubic ease-out for smooth deceleration
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = () => {
      const elapsed = performance.now() - startTime;

      if (pointerInteracting.current === null) {
        // Very slow rotation for cinematic feel
        phiRef.current += 0.001;

        if (elapsed < INTRO_DURATION) {
          // Cinematic intro: pan from Italy to Scandinavia
          const progress = easeOutCubic(Math.min(elapsed / INTRO_DURATION, 1));
          thetaRef.current = THETA_START + (THETA_END - THETA_START) * progress;
        } else {
          // After intro: subtle breathing motion around Scandinavia
          const postIntro = elapsed - INTRO_DURATION;
          thetaRef.current = THETA_END + Math.sin(postIntro * 0.00015) * 0.02;
        }
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
        transform: ready ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 1.5s cubic-bezier(0.22,1,0.36,1), transform 1.8s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div className="absolute inset-[-30%] rounded-full bg-[hsl(210_80%_20%/0.5)] blur-[120px] animate-pulse" style={{ animationDuration: '5s' }} />
      <div className="absolute inset-[-15%] rounded-full bg-[hsl(200_90%_40%/0.15)] blur-[80px]" />
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
