import { useEffect, useRef, useCallback, useState } from 'react';
import createGlobe from 'cobe';
import { useIsMobile } from '@/hooks/use-mobile';

interface GlobeProps {
  className?: string;
}

/**
 * Premium interactive dot-matrix globe.
 * Starts zoomed out, auto-rotates to Scandinavia, then settles.
 * Pulsing city markers, multi-layer glow, scroll parallax.
 */
const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef(-0.5); // Start facing Atlantic, rotate to Scandinavia
  const thetaRef = useRef(0.15);
  const scaleRef = useRef(0.85); // Start small, zoom in
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const startTime = useRef(Date.now());
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  // Intersection observer for scroll-triggered entrance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
    if (!canvas || !isVisible) return;

    let animationFrame: number;
    let width = canvas.offsetWidth;
    startTime.current = Date.now();

    const dpr = isMobile ? 1.5 : 2;
    const samples = isMobile ? 16000 : 24000;

    // Scandinavia target phi ≈ 0.25 (longitude ~15°)
    const targetPhi = 0.25;
    const introSeconds = 3.5; // How long the intro rotation takes

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * 2,
      height: width * 2,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 3.5,
      mapSamples: samples,
      mapBrightness: 10,
      mapBaseBrightness: 0.02,
      baseColor: [0.01, 0.06, 0.18],    // Ultra deep blue
      markerColor: [0.35, 0.85, 1],     // Bright cyan
      glowColor: [0.02, 0.1, 0.3],      // Deep blue glow
      scale: scaleRef.current,
      markers: [
        // Scandinavia — prominent
        { location: [59.3293, 18.0686], size: 0.12 },  // Stockholm ★
        { location: [55.6761, 12.5683], size: 0.08 },  // Copenhagen
        { location: [59.9139, 10.7522], size: 0.08 },  // Oslo
        { location: [60.1699, 24.9384], size: 0.07 },  // Helsinki
        { location: [57.7089, 11.9746], size: 0.07 },  // Gothenburg
        { location: [55.604, 13.003], size: 0.06 },    // Malmö
        { location: [63.8258, 20.2630], size: 0.05 },  // Umeå
        { location: [67.8558, 20.2253], size: 0.04 },  // Kiruna
        { location: [61.4978, 23.761], size: 0.04 },   // Tampere
        { location: [56.1629, 10.2039], size: 0.04 },  // Aarhus
        // Europe
        { location: [51.5074, -0.1278], size: 0.06 },  // London
        { location: [48.8566, 2.3522], size: 0.06 },   // Paris
        { location: [52.52, 13.405], size: 0.06 },     // Berlin
        { location: [41.9028, 12.4964], size: 0.04 },  // Rome
        { location: [40.4168, -3.7038], size: 0.04 },  // Madrid
        { location: [50.0755, 14.4378], size: 0.03 },  // Prague
        { location: [52.3676, 4.9041], size: 0.04 },   // Amsterdam
        { location: [47.3769, 8.5417], size: 0.03 },   // Zurich
        // Global
        { location: [40.7128, -74.006], size: 0.05 },  // NYC
        { location: [37.7749, -122.4194], size: 0.04 },// SF
        { location: [35.6762, 139.6503], size: 0.04 }, // Tokyo
        { location: [1.3521, 103.8198], size: 0.03 },  // Singapore
        { location: [25.2048, 55.2708], size: 0.03 },  // Dubai
        { location: [-33.8688, 151.2093], size: 0.03 },// Sydney
      ],
    });

    const animate = () => {
      const elapsed = (Date.now() - startTime.current) / 1000;

      // Intro animation: smoothly rotate to Scandinavia and zoom in
      if (elapsed < introSeconds) {
        const t = elapsed / introSeconds;
        // Smooth cubic ease-out
        const ease = 1 - Math.pow(1 - t, 3);

        // Rotate from -0.5 to targetPhi
        phiRef.current = -0.5 + (targetPhi + 0.5) * ease;
        // Tilt slightly
        thetaRef.current = 0.15 + 0.1 * ease;
        // Zoom in from 0.85 to 1
        scaleRef.current = 0.85 + 0.15 * ease;
      } else {
        // Post-intro: slow idle rotation
        if (pointerInteracting.current === null) {
          phiRef.current += 0.001;
        } else {
          phiRef.current += pointerDelta.current / 300;
          pointerDelta.current *= 0.9;
        }
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: scaleRef.current,
        width: width * 2,
        height: width * 2,
      });

      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      globe.destroy();
    };
  }, [isMobile, isVisible]);

  return (
    <div ref={containerRef} className={`relative aspect-square ${className}`} aria-hidden="true">
      {/* Multi-layer atmospheric glow */}
      <div className="absolute inset-[-40%] rounded-full bg-[hsl(210_80%_18%/0.5)] blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute inset-[-25%] rounded-full bg-[hsl(195_90%_35%/0.15)] blur-[90px]" />
      <div className="absolute inset-[-10%] rounded-full bg-[hsl(190_100%_50%/0.08)] blur-[60px]" />
      
      {/* Scandinavia spotlight beam */}
      <div 
        className="absolute w-[30%] h-[40%] top-[15%] right-[25%] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(190 100% 60% / 0.3), transparent 70%)',
          filter: 'blur(20px)',
          animation: 'pulse 3s ease-in-out infinite',
        }}
      />

      {/* Orbiting ring */}
      <div className="absolute inset-[-8%] rounded-full border border-white/[0.03] animate-[spin_60s_linear_infinite]" />
      <div className="absolute inset-[-15%] rounded-full border border-white/[0.02] animate-[spin_90s_linear_infinite_reverse]" />

      {/* Floating particles */}
      {!isMobile && (
        <>
          <div className="absolute w-1 h-1 rounded-full bg-secondary/60 top-[10%] right-[20%] animate-[float_6s_ease-in-out_infinite]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-accent/40 top-[25%] left-[15%] animate-[float_8s_ease-in-out_infinite_-2s]" />
          <div className="absolute w-1 h-1 rounded-full bg-secondary/50 bottom-[30%] right-[10%] animate-[float_7s_ease-in-out_infinite_-4s]" />
          <div className="absolute w-0.5 h-0.5 rounded-full bg-white/30 top-[50%] left-[10%] animate-[float_5s_ease-in-out_infinite_-1s]" />
          <div className="absolute w-1 h-1 rounded-full bg-secondary/40 bottom-[15%] left-[25%] animate-[float_9s_ease-in-out_infinite_-3s]" />
        </>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onMouseMove={onMouseMove}
        className={`w-full h-full cursor-grab select-none transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
