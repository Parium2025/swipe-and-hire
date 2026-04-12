import { useEffect, useRef, useCallback } from 'react';
import createGlobe from 'cobe';

interface GlobeProps {
  className?: string;
}

const Globe = ({ className = '' }: GlobeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const phiRef = useRef(0.25); // Start focused on Scandinavia
  const pointerInteracting = useRef<number | null>(null);
  const pointerDelta = useRef(0);

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

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: phiRef.current,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.05, 0.15, 0.35],
      markerColor: [0.3, 0.7, 1],
      glowColor: [0.05, 0.2, 0.5],
      markers: [
        { location: [59.3293, 18.0686], size: 0.08 },
        { location: [55.6761, 12.5683], size: 0.06 },
        { location: [59.9139, 10.7522], size: 0.06 },
        { location: [60.1699, 24.9384], size: 0.05 },
        { location: [57.7089, 11.9746], size: 0.05 },
        { location: [55.604, 13.003], size: 0.04 },
        { location: [51.5074, -0.1278], size: 0.04 },
        { location: [48.8566, 2.3522], size: 0.04 },
        { location: [52.52, 13.405], size: 0.04 },
        { location: [40.4168, -3.7038], size: 0.03 },
      ],
    });
    globeRef.current = globe;

    const animate = () => {
      if (pointerInteracting.current === null) {
        phiRef.current += 0.003;
      } else {
        phiRef.current += pointerDelta.current / 200;
        pointerDelta.current *= 0.95;
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: phiRef.current,
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
  }, []);

  return (
    <div className={`relative aspect-square ${className}`}>
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
