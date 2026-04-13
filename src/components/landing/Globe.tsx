import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const lonToPhiCobe = (lonDeg: number) => -((lonDeg + 90) * Math.PI) / 180;
const latToThetaCobe = (latDeg: number) => (latDeg * Math.PI) / 180;

const PHI_STOCKHOLM = lonToPhiCobe(18);
const PHI_ROME = lonToPhiCobe(12);
const THETA_ROME = latToThetaCobe(42);
const THETA_STOCKHOLM = latToThetaCobe(59);

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame: number;
    const startTime = performance.now();
    const introDuration = isMobile ? 1800 : 2800;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.2);
    const minRenderSize = isMobile ? 280 : 360;
    const maxRenderSize = isMobile ? 340 : 760;
    const renderSize = Math.min(Math.max(canvas.offsetWidth || minRenderSize, minRenderSize), maxRenderSize);

    let currentPhi = PHI_ROME;
    let currentTheta = THETA_ROME;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: renderSize * dpr,
      height: renderSize * dpr,
      phi: currentPhi,
      theta: currentTheta,
      scale: isMobile ? 1.48 : 1.42,
      offset: isMobile ? [0.06, 0.02] : [0.12, 0.04],
      dark: 1,
      diffuse: 1.6,
      mapSamples: isMobile ? 1600 : 5000,
      mapBrightness: 5,
      mapBaseBrightness: 0.08,
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
      if (document.hidden) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      const elapsed = now - startTime;

      if (elapsed < introDuration) {
        const progress = easeInOutCubic(Math.min(elapsed / introDuration, 1));
        currentPhi = PHI_ROME + (PHI_STOCKHOLM - PHI_ROME) * progress;
        currentTheta = THETA_ROME + (THETA_STOCKHOLM - THETA_ROME) * progress;
      } else {
        if (isMobile) {
          globe.update({
            phi: PHI_STOCKHOLM,
            theta: THETA_STOCKHOLM,
          });
          return;
        }

        const postIntro = elapsed - introDuration;
        currentPhi = PHI_STOCKHOLM + Math.sin(postIntro * 0.00008) * 0.006;
        currentTheta = THETA_STOCKHOLM + Math.sin(postIntro * 0.0001) * 0.004;
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
