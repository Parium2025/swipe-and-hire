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

    let animationFrame: number;
    let width = canvas.offsetWidth;
    const startTime = performance.now();
    const dpr = isMobile ? 1.5 : 2;

    // Cobe coordinate system:
    // phi = horizontal rotation (longitude). Higher values rotate the globe.
    // theta = vertical tilt. Higher = more northern hemisphere visible.
    //
    // To find the correct phi for Scandinavia, we convert:
    // Stockholm longitude = 18°E = 18 * π/180 ≈ 0.314 rad
    // But cobe's phi=0 starting position needs to be determined empirically.
    //
    // Based on testing: cobe phi=0 shows ~Prime Meridian (0° lon).
    // Positive phi rotates the globe so eastern longitudes come into view.
    // For Scandinavia (~18°E): phi ≈ 0.3 rad should be correct.
    //
    // However, if the globe still shows Americas, the coordinate system 
    // might be inverted. Trying negative phi or offset by π.

    const INTRO_DURATION = 6000;
    const THETA_START = 0.1;
    const THETA_END = 0.3;
    
    // Try negative phi to rotate in opposite direction toward Europe
    // If phi=0.3 shows Americas, then Europe might be at phi = -0.3 or phi = π+0.3
    const PHI_EUROPE = -0.3;
    
    let currentPhi = PHI_EUROPE;
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
        // Scandinavian capitals - will glow cyan to verify positioning
        { location: [59.33, 18.07], size: 0.06 }, // Stockholm
        { location: [59.91, 10.75], size: 0.04 }, // Oslo
        { location: [55.68, 12.57], size: 0.04 }, // Copenhagen
        { location: [60.17, 24.94], size: 0.04 }, // Helsinki
        { location: [51.51, -0.13], size: 0.04 },  // London
        { location: [48.86, 2.35], size: 0.04 },   // Paris
        { location: [52.52, 13.41], size: 0.04 },  // Berlin
      ],
    });

    requestAnimationFrame(() => setReady(true));

    const animate = () => {
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
