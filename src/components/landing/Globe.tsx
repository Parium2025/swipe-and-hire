import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const lonToPhiCobe = (lonDeg: number) => -Math.PI / 2 - (lonDeg * Math.PI) / 180;
const latToThetaCobe = (latDeg: number) => (latDeg * Math.PI) / 180;

const PHI_ROME = lonToPhiCobe(12.4964);
const PHI_EUROPE = lonToPhiCobe(16);
const THETA_ROME = latToThetaCobe(41.9028);
const THETA_EUROPE = latToThetaCobe(57);

const STOCKHOLM: [number, number] = [59.3293, 18.0686];
const ROME: [number, number] = [41.9028, 12.4964];

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame = 0;
    const startTime = performance.now();
    const introDuration = isMobile ? 1600 : 2600;
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
      width: renderSize,
      height: renderSize,
      phi: currentPhi,
      theta: currentTheta,
      scale: isMobile ? 1.04 : 1.08,
      offset: isMobile ? [0, 0.01] : [0.02, 0.015],
      dark: 1,
      diffuse: 1.25,
      mapSamples: isMobile ? 4200 : 9000,
      mapBrightness: isMobile ? 6.8 : 7.2,
      mapBaseBrightness: 0.06,
      baseColor: [0.03, 0.07, 0.16],
      markerColor: [0.42, 0.88, 1],
      glowColor: [0.1, 0.36, 0.82],
      arcColor: [0.36, 0.78, 1],
      arcWidth: 0.8,
      arcHeight: 0.12,
      markerElevation: 0.02,
      markers: [
        { location: STOCKHOLM, size: isMobile ? 0.038 : 0.03, color: [0.76, 0.96, 1] },
        { location: ROME, size: isMobile ? 0.026 : 0.022, color: [0.32, 0.78, 1] },
      ],
      arcs: [
        { from: ROME, to: STOCKHOLM, color: [0.36, 0.78, 1] },
      ],
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

        globe.update({
          phi: currentPhi,
          theta: currentTheta,
        });

        animationFrame = requestAnimationFrame(animate);
        return;
      }

      if (isMobile) {
        globe.update({
          phi: PHI_EUROPE,
          theta: THETA_EUROPE,
        });
        return;
      }

      const postIntro = elapsed - introDuration;
      globe.update({
        phi: PHI_EUROPE + Math.sin(postIntro * 0.00008) * 0.004,
        theta: THETA_EUROPE + Math.sin(postIntro * 0.0001) * 0.0025,
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
