import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

// ── Cobe phi mapping ──
// phi=0 shows lon ≈ -90° (Americas). Increasing phi rotates eastward.
// phi = (targetLon + 90) * π / 180
const PHI_STOCKHOLM = ((18 + 90) * Math.PI) / 180;  // ≈ 1.885
const PHI_ROME      = ((12 + 90) * Math.PI) / 180;  // ≈ 1.780
const INTRO_DURATION = 3500;
const THETA_START = 0.18;
const THETA_END   = 0.35;

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame: number;
    const startTime = performance.now();
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const renderSize = isMobile ? 400 : Math.min(Math.max(canvas.offsetWidth, 320), 960);

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
      scale: isMobile ? 1.35 : 1.45,
      offset: isMobile ? [0.12, 0.04] : [0.14, 0.03],
      dark: 1,
      diffuse: 2.4,
      mapSamples: isMobile ? 3000 : 8000,
      mapBrightness: 6,
      mapBaseBrightness: 0.12,
      baseColor: [0.05, 0.1, 0.25],
      markerColor: [0.4, 0.9, 1],
      glowColor: [0.08, 0.2, 0.6],
      markers: [],
      context: {
        antialias: false,
        alpha: true,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
        preserveDrawingBuffer: false,
      },
    });

    requestAnimationFrame(() => setReady(true));

    const animate = (now: number) => {
      if (document.hidden) return;

      const elapsed = now - startTime;

      if (elapsed < INTRO_DURATION) {
        const progress = easeInOutCubic(Math.min(elapsed / INTRO_DURATION, 1));
        currentPhi = PHI_ROME + (PHI_STOCKHOLM - PHI_ROME) * progress;
        currentTheta = THETA_START + (THETA_END - THETA_START) * progress;
      } else {
        // Gentle breathing on Stockholm — no continuous drift
        const postIntro = elapsed - INTRO_DURATION;
        currentPhi = PHI_STOCKHOLM + Math.sin(postIntro * 0.0001) * 0.015;
        currentTheta = THETA_END + Math.sin(postIntro * 0.00014) * 0.008;
      }

      globe.update({
        phi: currentPhi,
        theta: currentTheta,
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
      <canvas
        ref={canvasRef}
        className="w-full h-full select-none"
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
