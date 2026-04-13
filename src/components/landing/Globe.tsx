import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

// ── Cobe coordinate math (from issue shuding/cobe#101) ──
// The camera "look-at" direction for a given (phi, theta) is:
//   m = [-sin(phi)*cos(theta), sin(theta), cos(phi)*cos(theta)]
// Which maps to geographic coordinates:
//   lat  = asin(sin(theta))   → theta in radians ≈ latitude in radians
//   lon  = atan2(-cos(phi)*cos(theta), -sin(phi)*cos(theta))
//
// phi=0 → lon = atan2(-1, 0) = -90° (central Americas)
//
// To center on a target longitude:
//   phi = atan2(-cos(lonRad), -sin(lonRad))  (with theta≈0)
//
// Stockholm: lon=18°E → 0.314 rad → phi = atan2(-cos(0.314), -sin(0.314))
//   = atan2(-0.951, -0.309) ≈ -1.884 rad  ✓
// Rome: lon=12°E → 0.209 rad → phi ≈ -1.78 rad

const lonToPhiCobe = (lonDeg: number): number => {
  const lonRad = (lonDeg * Math.PI) / 180;
  return Math.atan2(-Math.cos(lonRad), -Math.sin(lonRad));
};

// Pre-computed phi values
const PHI_STOCKHOLM = lonToPhiCobe(18);  // ≈ -1.884
const PHI_ROME = lonToPhiCobe(12);       // ≈ -1.78
const INTRO_DURATION = 4200;
const THETA_START = 0.16;
const THETA_END = 0.34;

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerInteracting.current = e.clientX - pointerDelta.current;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    canvasRef.current?.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e?: React.PointerEvent<HTMLCanvasElement>) => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    if (e && canvasRef.current?.hasPointerCapture?.(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onPointerOut = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerInteracting.current !== null) {
      pointerDelta.current = e.clientX - pointerInteracting.current;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame: number;
    let resizeObserver: ResizeObserver | null = null;
    const startTime = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.2);
    const frameInterval = isMobile ? 1000 / 24 : 1000 / 30;
    const maxRenderSize = isMobile ? 720 : 960;
    const getRenderSize = () => Math.min(Math.max(canvas.offsetWidth, 320), maxRenderSize);
    let renderSize = getRenderSize();
    let lastFrameTime = 0;

    let currentPhi = PHI_ROME;
    let currentTheta = THETA_START;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: renderSize * dpr,
      height: renderSize * dpr,
      phi: currentPhi,
      theta: currentTheta,
      scale: isMobile ? 1.28 : 1.38,
      offset: isMobile ? [0.14, 0.02] : [0.16, 0.02],
      dark: 1,
      diffuse: 2.8,
      mapSamples: isMobile ? 6000 : 9000,
      mapBrightness: 8,
      mapBaseBrightness: 0.15,
      baseColor: [0.05, 0.1, 0.25],
      markerColor: [0.4, 0.9, 1],
      glowColor: [0.08, 0.2, 0.6],
      markers: [], // Clean look, no markers
      context: {
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      },
    });

    requestAnimationFrame(() => setReady(true));

    const handleResize = () => {
      renderSize = getRenderSize();
      globe.update({
        width: renderSize * dpr,
        height: renderSize * dpr,
      });
    };

    const supportsResizeObserver = typeof ResizeObserver !== 'undefined';

    if (supportsResizeObserver) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', handleResize);
    }

    const animate = (now: number) => {
      animationFrame = requestAnimationFrame(animate);

      if (document.hidden) return;
      if (now - lastFrameTime < frameInterval) return;
      lastFrameTime = now;

      const elapsed = now - startTime;

      if (pointerInteracting.current === null) {
        if (elapsed < INTRO_DURATION) {
          const progress = easeInOutCubic(Math.min(elapsed / INTRO_DURATION, 1));
          currentPhi = PHI_ROME + (PHI_STOCKHOLM - PHI_ROME) * progress;
          currentTheta = THETA_START + (THETA_END - THETA_START) * progress;
        } else {
          const postIntro = elapsed - INTRO_DURATION;
          currentPhi -= isMobile ? 0.00018 : 0.00024;
          currentTheta = THETA_END + Math.sin(postIntro * 0.00016) * 0.01;
        }
      } else {
        currentPhi += pointerDelta.current / 360;
        pointerDelta.current *= 0.88;
      }

      globe.update({
        phi: currentPhi,
        theta: currentTheta,
      });
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
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
      <div className="absolute inset-[-18%] rounded-full bg-[hsl(210_80%_20%/0.35)] blur-[88px]" />
      <div className="absolute inset-[-10%] rounded-full bg-[hsl(200_90%_40%/0.12)] blur-[54px]" />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onPointerCancel={onPointerUp}
        onPointerMove={onPointerMove}
        className="w-full h-full cursor-grab select-none"
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
