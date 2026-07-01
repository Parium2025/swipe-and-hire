import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  style?: CSSProperties;
  zoom?: number;
  active?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

export const SplinePhone = ({ className, style, zoom = 0.78, active = true }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const activeRef = useRef(active);
  const zoomRef = useRef(zoom);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
    zoomRef.current = zoom;
    const app = appRef.current;
    if (!app || !isReady) return;
    app.setZoom(zoom);
    requestAnimationFrame(() => appRef.current?.setZoom(zoom));
  }, [zoom, isReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: SplineApplication | null = null;

    const waitForFrames = (count: number) =>
      new Promise<void>((resolve) => {
        const tick = (remaining: number) => {
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => tick(remaining - 1));
        };
        tick(count);
      });

    const waitForVisualSettle = async () => {
      const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
      await waitForFrames(isCoarse ? 10 : 4);
      await new Promise<void>((resolve) => window.setTimeout(resolve, isCoarse ? 760 : 140));
      await waitForFrames(isCoarse ? 4 : 1);
    };

    const boot = async () => {
      try {
        const { Application } = await import('@splinetool/runtime');
        if (cancelled) return;

        if (typeof window !== 'undefined' && 'devicePixelRatio' in window) {
          try {
            Object.defineProperty(canvas, '_dprCap', {
              value: Math.min(window.devicePixelRatio || 1, 2),
              configurable: true,
            });
          } catch {
            /* no-op */
          }
        }

        app = new Application(canvas, { renderMode: 'auto' });
        appRef.current = app;
        await app.load(SCENE_URL);
        // Cap pixel ratio on mobile/touch devices to free GPU bandwidth.
        // dpr=3 på iPhone 14 betyder 9x pixels att rita per frame — vi sänker
        // till max 1.5 där, vilket är osynligt på en 393px-skärm men ger
        // 30–40% lägre GPU-belastning så övriga scroll-animationer stannar
        // smooth. Desktop lämnas orört (max 2).
        try {
          const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
          const cap = isCoarse ? 1.5 : 2;
          const renderer = (app as unknown as { renderer?: { setPixelRatio?: (n: number) => void } }).renderer;
          renderer?.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, cap));
        } catch { /* no-op */ }
        // Spline-scenen kan ha en egen background-color som annars syns som
        // en vit ram innan WebGL fyller canvasen. Tvinga transparent.
        try {
          (app as unknown as { setBackgroundColor?: (c: string) => void })
            .setBackgroundColor?.('rgba(0,0,0,0)');
        } catch { /* no-op */ }
        app.setZoom(zoomRef.current);
        requestAnimationFrame(() => app?.setZoom(zoomRef.current));
        if (!activeRef.current) app.stop();
        // Vänta tills WebGL/Spline har hunnit rita en stabil visuell frame innan
        // canvasen släpps igenom. På mobil kan Spline annars visa en kort vit
        // placeholder-yta/rektangel vid refresh innan telefonens material är klart.
        await waitForVisualSettle();
        if (!cancelled) {
          setIsReady(true);
          // Signal till FixedPhoneLayer att vi får visa wrappern utan att
          // det blir ett synligt tomt/vitt lager innan WebGL ritar första frame.
          window.dispatchEvent(new Event('parium:spline-ready'));
        }
      } catch (error) {
        console.error('Kunde inte ladda Spline-telefonen:', error);
        if (!cancelled) setHasError(true);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);

  if (hasError) {
    return (
      <div
        ref={wrapperRef}
        aria-hidden="true"
        data-spline-phone
        className={`relative select-none overflow-visible ${className ?? ''}`}
        style={style}
      />
    );
  }

  return (
    <div
      ref={wrapperRef}
      data-spline-phone
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', ...style }}
    >
      <div
        data-spline-phone-host
        aria-hidden={!isReady}
        className="absolute inset-0"
        style={{
          opacity: isReady ? 1 : 0,
          visibility: isReady ? 'visible' : 'hidden',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'opacity',
          contain: 'layout paint style',
          backgroundColor: 'transparent',
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Parium 3D-telefon"
          tabIndex={-1}
          data-spline-phone-canvas
          className="relative h-full w-full cursor-grab bg-transparent outline-none active:cursor-grabbing"
          draggable={false}
          style={{
            colorScheme: 'normal',
            backgroundColor: 'transparent',
            display: 'block',
            opacity: 1,
            visibility: 'inherit',
            transition: 'none',
            willChange: 'auto',
            touchAction: 'none',
          }}
        />
      </div>
      {!isReady && (
        <div
          data-spline-phone-mask
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: 'transparent',
          touchAction: 'none',
        }}
        />
      )}
    </div>
  );
};

export default SplinePhone;
