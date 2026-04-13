import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const lonToPhiCobe = (lonDeg: number) => -Math.PI / 2 - (lonDeg * Math.PI) / 180;
const latToThetaCobe = (latDeg: number) => (latDeg * Math.PI) / 180;

const PHI_ITALY = lonToPhiCobe(12.4964);
const THETA_ITALY = latToThetaCobe(41.9028);
const PHI_EUROPE_FOCUS = lonToPhiCobe(14.5);
const THETA_EUROPE_FOCUS = latToThetaCobe(53.8);

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame = 0;
    const startTime = performance.now();
    const introDuration = isMobile ? 1600 : 2500;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.2);
    const minRenderSize = isMobile ? 320 : 420;
    const maxRenderSize = isMobile ? 420 : 840;
    const renderSize = Math.min(Math.max(canvas.offsetWidth || minRenderSize, minRenderSize), maxRenderSize);
    const view = isMobile
      ? {
          scale: 1.68,
          offset: [0, 0.085] as [number, number],
          mapSamples: 9000,
          mapBrightness: 9.9,
        }
      : {
          scale: 1.38,
          offset: [0.015, 0.05] as [number, number],
          mapSamples: 16000,
          mapBrightness: 10.2,
        };

    let currentPhi = PHI_ITALY;
    let currentTheta = THETA_ITALY;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: renderSize,
      height: renderSize,
      phi: currentPhi,
      theta: currentTheta,
      scale: view.scale,
      offset: view.offset,
      dark: 0.92,
      diffuse: 1.4,
      mapSamples: view.mapSamples,
      mapBrightness: view.mapBrightness,
      mapBaseBrightness: 0.04,
      baseColor: [0.03, 0.06, 0.14],
      markerColor: [0.42, 0.88, 1],
      glowColor: [0.1, 0.34, 0.8],
      markers: [],
      arcs: [],
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
        currentPhi = PHI_ITALY + (PHI_EUROPE_FOCUS - PHI_ITALY) * progress;
        currentTheta = THETA_ITALY + (THETA_EUROPE_FOCUS - THETA_ITALY) * progress;

        globe.update({
          phi: currentPhi,
          theta: currentTheta,
        });

        animationFrame = requestAnimationFrame(animate);
        return;
      }

      if (isMobile) {
        globe.update({
          phi: PHI_EUROPE_FOCUS,
          theta: THETA_EUROPE_FOCUS,
        });
        return;
      }

      const postIntro = elapsed - introDuration;
      globe.update({
        phi: PHI_EUROPE_FOCUS + Math.sin(postIntro * 0.00008) * 0.0022,
        theta: THETA_EUROPE_FOCUS + Math.sin(postIntro * 0.0001) * 0.0016,
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
