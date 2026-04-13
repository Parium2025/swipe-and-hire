import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

const lonToPhiCobe = (lonDeg: number) => -Math.PI / 2 - (lonDeg * Math.PI) / 180;
const latToThetaCobe = (latDeg: number) => (latDeg * Math.PI) / 180;

const ROME: [number, number] = [41.9028, 12.4964];
const COPENHAGEN: [number, number] = [55.6761, 12.5683];
const STOCKHOLM: [number, number] = [59.3293, 18.0686];

const START_PHI = lonToPhiCobe(ROME[1]);
const START_THETA = latToThetaCobe(ROME[0]);
const FOCUS_PHI = lonToPhiCobe(15.6);
const FOCUS_THETA = latToThetaCobe(55.8);

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame = 0;
    const startTime = performance.now();
    const introDuration = isMobile ? 2200 : 3200;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.2);
    const minRenderSize = isMobile ? 320 : 420;
    const maxRenderSize = isMobile ? 420 : 840;
    const renderSize = Math.min(Math.max(canvas.offsetWidth || minRenderSize, minRenderSize), maxRenderSize);

    const view = isMobile
      ? {
          scale: 1.28,
          offset: [0, 0.03] as [number, number],
          mapSamples: 12000,
          mapBrightness: 10.4,
          markerSizes: [0.085, 0.07, 0.095] as const,
        }
      : {
          scale: 1.18,
          offset: [0.012, 0.02] as [number, number],
          mapSamples: 18000,
          mapBrightness: 10.6,
          markerSizes: [0.07, 0.055, 0.08] as const,
        };

    let currentPhi = START_PHI;
    let currentTheta = START_THETA;

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
      dark: 1,
      diffuse: 1.25,
      mapSamples: view.mapSamples,
      mapBrightness: view.mapBrightness,
      mapBaseBrightness: 0.02,
      baseColor: [0.01, 0.03, 0.08],
      markerColor: [0.68, 0.93, 1],
      glowColor: [0.1, 0.38, 0.92],
      markers: [
        { location: ROME, size: view.markerSizes[0] },
        { location: COPENHAGEN, size: view.markerSizes[1] },
        { location: STOCKHOLM, size: view.markerSizes[2] },
      ],
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
        currentPhi = START_PHI + (FOCUS_PHI - START_PHI) * progress;
        currentTheta = START_THETA + (FOCUS_THETA - START_THETA) * progress;

        globe.update({
          phi: currentPhi,
          theta: currentTheta,
        });

        animationFrame = requestAnimationFrame(animate);
        return;
      }

      const postIntro = elapsed - introDuration;
      const floatPhi = Math.sin(postIntro * 0.00008) * 0.0018;
      const floatTheta = Math.sin(postIntro * 0.00011) * 0.0014;
      const northDrift = Math.sin(postIntro * 0.000045) * 0.0012;

      globe.update({
        phi: FOCUS_PHI + floatPhi,
        theta: FOCUS_THETA + floatTheta + northDrift,
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
      className={`relative isolate overflow-hidden rounded-full ${className}`}
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 1.5s cubic-bezier(0.22,1,0.36,1), transform 1.8s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full select-none"
        style={{ contain: 'layout paint size', aspectRatio: '1', display: 'block' }}
      />
    </div>
  );
};

export default Globe;
