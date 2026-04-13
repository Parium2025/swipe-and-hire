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

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    // Cinematic intro: pan from Rome → Stockholm over 6 seconds
    const INTRO_DURATION = 6000;
    const THETA_START = 0.15; // slight tilt (lower Europe)
    const THETA_END = 0.35;   // more northern tilt (Scandinavia)

    let currentPhi = PHI_ROME;
    let currentTheta = THETA_START;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: width * dpr,
      phi: currentPhi,
      theta: currentTheta,
      dark: 1,
      diffuse: 6,
      mapSamples: isMobile ? 20000 : 40000,
      mapBrightness: 20,
      baseColor: [0.05, 0.1, 0.25],
      markerColor: [0.4, 0.9, 1],
      glowColor: [0.08, 0.2, 0.6],
      markers: [], // Clean look, no markers
    });

    requestAnimationFrame(() => setReady(true));

    const animate = () => {
      const elapsed = performance.now() - startTime;

      if (pointerInteracting.current === null) {
        if (elapsed < INTRO_DURATION) {
          // Cinematic pan from Italy to Scandinavia
          const progress = easeOutCubic(Math.min(elapsed / INTRO_DURATION, 1));
          currentPhi = PHI_ROME + (PHI_STOCKHOLM - PHI_ROME) * progress;
          currentTheta = THETA_START + (THETA_END - THETA_START) * progress;
        } else {
          // After intro: ultra-slow drift + subtle breathing
          const postIntro = elapsed - INTRO_DURATION;
          currentPhi -= 0.0003; // very slow westward drift (negative = eastward in cobe)
          currentTheta = THETA_END + Math.sin(postIntro * 0.00012) * 0.015;
        }
      } else {
        currentPhi += pointerDelta.current / 300;
        pointerDelta.current *= 0.92;
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: currentPhi,
        theta: currentTheta,
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
