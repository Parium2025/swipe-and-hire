import { useEffect, useRef, useState } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  zoom?: number;
  active?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

export const SplinePhone = ({ className, zoom = 0.78, active = true }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const activeRef = useRef(active);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Signal till ev. parent-layer att vi är "redo" att synas — även vid fel,
  // så hero:n inte gömmer sig för alltid.
  useEffect(() => {
    if (isReady || hasError) {
      window.dispatchEvent(new Event('parium:spline-ready'));
    }
  }, [isReady, hasError]);

  useEffect(() => {
    activeRef.current = active;
    const app = appRef.current;
    if (!app) return;
    if (active) {
      if (app.isStopped) app.play();
    } else if (!app.isStopped) {
      app.stop();
    }
  }, [active, isReady]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !isReady) return;
    app.setZoom(zoom);
    requestAnimationFrame(() => appRef.current?.setZoom(zoom));
  }, [zoom, isReady]);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: SplineApplication | null = null;

    (async () => {
      try {
        const { Application } = await import('@splinetool/runtime');
        if (cancelled) return;

        app = new Application(canvas, { renderMode: 'auto' });
        appRef.current = app;
        await app.load(SCENE_URL);
        try {
          (app as unknown as { setBackgroundColor?: (c: string) => void })
            .setBackgroundColor?.('rgba(0,0,0,0)');
        } catch { /* no-op */ }
        app.setZoom(zoom);
        requestAnimationFrame(() => app?.setZoom(zoom));
        if (!activeRef.current) app.stop();
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve()),
          );
        });
        if (!cancelled) setIsReady(true);
      } catch (error) {
        console.error('Kunde inte ladda Spline-telefonen:', error);
        if (!cancelled) setHasError(true);
      }
    })();

    return () => {
      cancelled = true;
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Parium 3D-telefon"
        tabIndex={-1}
        className="relative h-full w-full cursor-grab bg-transparent outline-none transition-opacity duration-700 active:cursor-grabbing"
        draggable={false}
        style={{ colorScheme: 'normal', opacity: isReady ? 1 : 0, touchAction: 'none' }}
      />
    </div>
  );
};

export default SplinePhone;
