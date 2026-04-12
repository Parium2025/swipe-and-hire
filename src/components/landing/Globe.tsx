import { useEffect, useRef, useCallback } from 'react';
import createGlobe from 'cobe';

interface GlobeProps {
  className?: string;
}

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
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
      const delta = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
    }
  }, []);

  useEffect(() => {
    let width = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => {
      if (canvas) {
        width = canvas.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3, // Tilt to show Scandinavia nicely
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.05, 0.15, 0.35], // Deep Parium blue
      markerColor: [0.3, 0.7, 1], // Bright accent blue
      glowColor: [0.05, 0.2, 0.5], // Parium glow
      markers: [
        // Scandinavian cities - highlighted
        { location: [59.3293, 18.0686], size: 0.08 }, // Stockholm
        { location: [55.6761, 12.5683], size: 0.06 }, // Copenhagen
        { location: [59.9139, 10.7522], size: 0.06 }, // Oslo
        { location: [60.1699, 24.9384], size: 0.05 }, // Helsinki
        { location: [57.7089, 11.9746], size: 0.05 }, // Gothenburg
        { location: [55.604, 13.003], size: 0.04 },   // Malmö
        // Other European cities
        { location: [51.5074, -0.1278], size: 0.04 }, // London
        { location: [48.8566, 2.3522], size: 0.04 },  // Paris
        { location: [52.52, 13.405], size: 0.04 },    // Berlin
        { location: [40.4168, -3.7038], size: 0.03 }, // Madrid
      ],
      onRender: (state) => {
        if (pointerInteracting.current === null) {
          phiRef.current += 0.003; // Slow auto-rotation
        } else {
          phiRef.current += pointerInteractionMovement.current / 200;
          pointerInteractionMovement.current *= 0.95;
        }
        state.phi = phiRef.current;
        // Focus on Scandinavia: longitude ~15° → phi offset
        state.phi += 0.25;
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    return () => {
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className={`relative aspect-square ${className}`}>
      {/* Outer glow */}
      <div className="absolute inset-[-20%] rounded-full bg-primary/20 blur-[80px]" />
      <div className="absolute inset-[-10%] rounded-full bg-secondary/10 blur-[60px]" />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onMouseMove={onMouseMove}
        className="w-full h-full cursor-grab"
        style={{ contain: 'layout paint size', aspectRatio: '1' }}
      />
    </div>
  );
};

export default Globe;
