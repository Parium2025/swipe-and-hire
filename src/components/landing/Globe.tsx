import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

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

    let width = canvas.offsetWidth;
    const dpr = isMobile ? 1.5 : 2;
    const startTime = performance.now();

    // Cobe coordinate system (verified from source + docs):
    // phi = azimuthal rotation. Increases → rotates globe westward.
    // theta = polar tilt. Positive → tilts globe so northern hemisphere is more visible.
    //
    // Stockholm is at [59.33, 18.07] (lat, lon).
    // To center Europe/Scandinavia we need phi that aligns ~15°E longitude to center.
    // From empirical testing and cobe examples:
    //   phi ≈ 0 shows Africa/Europe (Greenwich meridian facing camera)
    //   Adding ~0.3 rotates slightly east
    //
    // We use onRender (the documented pattern) instead of globe.update()

    const INTRO_DURATION = 6000;
    // Start looking at Mediterranean, end at Scandinavia
    const THETA_START = 0.1;
    const THETA_END = 0.3;

    // phi for Europe: ~0.3 rad puts Scandinavia center-stage
    let currentPhi = 0.3;
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
      markers: [
        // Stockholm marker to verify positioning (tiny, subtle)
        { location: [59.33, 18.07], size: 0.05 },
        // Oslo
        { location: [59.91, 10.75], size: 0.03 },
        // Copenhagen
        { location: [55.68, 12.57], size: 0.03 },
        // Helsinki
        { location: [60.17, 24.94], size: 0.03 },
      ],
      onRender: (state) => {
        const elapsed = performance.now() - startTime;

        if (pointerInteracting.current === null) {
          if (elapsed < INTRO_DURATION) {
            const progress = easeOutCubic(Math.min(elapsed / INTRO_DURATION, 1));
            currentTheta = THETA_START + (THETA_END - THETA_START) * progress;
          } else {
            const postIntro = elapsed - INTRO_DURATION;
            currentPhi += 0.0003;
            currentTheta = THETA_END + Math.sin(postIntro * 0.00012) * 0.015;
          }
        } else {
          currentPhi += pointerDelta.current / 300;
          pointerDelta.current *= 0.92;
        }

        state.phi = currentPhi;
        state.theta = currentTheta;

        width = canvas.offsetWidth;
        state.width = width * dpr;
        state.height = width * dpr;

        if (!ready) setReady(true);
      },
    });

    return () => {
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
