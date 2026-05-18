import { useCallback, useEffect, useRef, useState } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  zoom?: number;
  active?: boolean;
  mobileFit?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

export const SplinePhone = ({ className, zoom = 0.78, active = true, mobileFit = false }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const activeRef = useRef(active);
  const zoomRef = useRef(zoom);
  const mobileFitRef = useRef(mobileFit);
  const basePhoneYRef = useRef<number | null>(null);
  const fitSceneToCanvas = useCallback((app: SplineApplication | null) => {
    if (!app) return;
    const phone = app.findObjectByName('iPhone 14 Pro');
    if (!phone) return;
    basePhoneYRef.current ??= phone.position.y;

    // På mobil låg exporterad Spline-modell för högt i kameran, vilket gav
    // visuell klippning trots att DOM/canvas hade rätt storlek. Flytta endast
    // hela telefon-objektet nedåt i scenen så hela modellen ryms i canvasen.
    phone.position.y = mobileFitRef.current ? -118 : basePhoneYRef.current;
    app.requestRender?.();
  }, []);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const syncCanvasSize = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const rect = wrapper.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const app = appRef.current;
    app?.setSize(cssWidth, cssHeight);
    app?.setZoom(zoomRef.current);
    fitSceneToCanvas(app);
  }, [fitSceneToCanvas]);

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
    mobileFitRef.current = mobileFit;
    fitSceneToCanvas(appRef.current);
  }, [mobileFit, fitSceneToCanvas]);

  useEffect(() => {
    const app = appRef.current;
    zoomRef.current = zoom;
    if (!app) return;
    syncCanvasSize();
    app.setZoom(zoom);
    requestAnimationFrame(() => appRef.current?.setZoom(zoom));
  }, [zoom, syncCanvasSize]);

  useEffect(() => {
    syncCanvasSize();
    const wrapper = wrapperRef.current;
    const observer = wrapper ? new ResizeObserver(syncCanvasSize) : null;
    if (wrapper) observer?.observe(wrapper);
    window.addEventListener('resize', syncCanvasSize, { passive: true });
    window.visualViewport?.addEventListener('resize', syncCanvasSize, { passive: true });
    const frame = requestAnimationFrame(syncCanvasSize);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
      window.visualViewport?.removeEventListener('resize', syncCanvasSize);
    };
  }, [syncCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: SplineApplication | null = null;

    (async () => {
      try {
        const { Application } = await import('@splinetool/runtime');
        if (cancelled) return;

        syncCanvasSize();
        app = new Application(canvas, {
          renderMode: 'continuous',
          wasmPath: `${window.location.origin}/spline-wasm`,
        });
        appRef.current = app;
        await app.load(SCENE_URL);
        syncCanvasSize();
        try {
          (app as unknown as { setBackgroundColor?: (c: string) => void })
            .setBackgroundColor?.('rgba(0,0,0,0)');
        } catch { /* no-op */ }
        app.setZoom(zoomRef.current);
        fitSceneToCanvas(app);
        requestAnimationFrame(() => {
          syncCanvasSize();
          app?.setZoom(zoomRef.current);
          fitSceneToCanvas(app);
        });
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
  }, [syncCanvasSize]);

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
        style={{ colorScheme: 'normal', opacity: 1, touchAction: 'none' }}
      />
    </div>
  );
};

export default SplinePhone;
