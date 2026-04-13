import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const lonToPhiCobe = (lonDeg: number) => -((lonDeg + 90) * Math.PI) / 180;
const latToThetaCobe = (latDeg: number) => (latDeg * Math.PI) / 180;

const PHI_EUROPE = lonToPhiCobe(16);
const PHI_ROME = lonToPhiCobe(12);
const THETA_ROME = latToThetaCobe(42);
const THETA_EUROPE = latToThetaCobe(55);

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame: number;
    const startTime = performance.now();
    const introDuration = isMobile ? 1800 : 3000;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.2);
    const minRenderSize = isMobile ? 320 : 420;
    const maxRenderSize = isMobile ? 420 : 840;
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
      scale: isMobile ? 1.12 : 1.18,
      offset: isMobile ? [0, 0.02] : [0.06, 0.03],
      dark: 1,
      diffuse: 2.1,
      mapSamples: isMobile ? 1800 : 5600,
      mapBrightness: 8,
      mapBaseBrightness: 0.42,
      baseColor: [0.12, 0.18, 0.34],
      markerColor: [0.4, 0.9, 1],
      glowColor: [0.14, 0.42, 0.86],
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
        currentPhi = PHI_ROME + (PHI_EUROPE - PHI_ROME) * progress;
        currentTheta = THETA_ROME + (THETA_EUROPE - THETA_ROME) * progress;
      } else {
        if (isMobile) {
          globe.update({
            phi: PHI_EUROPE,
            theta: THETA_EUROPE,
          });
          return;
        }

        const postIntro = elapsed - introDuration;
        currentPhi = PHI_EUROPE + Math.sin(postIntro * 0.00008) * 0.005;
        currentTheta = THETA_EUROPE + Math.sin(postIntro * 0.0001) * 0.003;
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
      <div className="absolute inset-0 rounded-full border border-white/10 shadow-[inset_0_0_40px_rgba(255,255,255,0.06),0_0_60px_rgba(56,189,248,0.12)]" />
      <canvas
        ref={canvasRef}
        className="w-full h-full select-none"
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
