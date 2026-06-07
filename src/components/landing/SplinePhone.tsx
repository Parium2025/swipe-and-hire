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
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    // Vänta tills webbläsaren är idle innan vi börjar ladda Spline-runtime
    // + scene-fil. På iPad/tablet-klass (coarse pointer, 700–1180px) väntar
    // vi dessutom på window 'load' + längre idle-timeout — annars blockerar
    // Spline-init huvudtråden under hela reload och sidan känns superseg.
    let loadListener: (() => void) | null = null;

    const startLoading = () => {
      if (cancelled) return;
      void boot();
    };

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };

    const isCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const widthPx = window.innerWidth || 0;
    const isTabletClass = isCoarse && widthPx >= 700 && widthPx <= 1180;
    const idleTimeout = isTabletClass ? 3500 : 1200;
    const fallbackDelay = isTabletClass ? 1200 : 250;

    const scheduleIdle = () => {
      if (cancelled) return;
      if (typeof w.requestIdleCallback === 'function') {
        idleHandle = w.requestIdleCallback(startLoading, { timeout: idleTimeout });
      } else {
        timeoutHandle = window.setTimeout(startLoading, fallbackDelay);
      }
    };

    // På iPad-klass: vänta på window 'load' (alla bilder/fonts klara) först.
    // Då blir HTML/CSS/hero-video interaktiva *innan* vi ens börjar parsa
    // Three.js + Spline-runtime, vilket gör reload markant snabbare.
    if (isTabletClass && document.readyState !== 'complete') {
      loadListener = () => scheduleIdle();
      window.addEventListener('load', loadListener, { once: true });
      // Säkerhetsnät: om 'load' aldrig fyrar, boota ändå efter 5s.
      timeoutHandle = window.setTimeout(scheduleIdle, 5000);
    } else {
      scheduleIdle();
    }

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
        // Vänta 3 rAF så Spline garanterat hunnit rita sin första WebGL-frame
        // innan vi fade:ar in canvasen. På throttlade enheter (Lovable preview-
        // iframe, äldre Androids) räcker inte 2 rAF — då syns scenens
        // default-bakgrund i en frame som "vit ram" runt telefonen.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve()),
            ),
          );
        });
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

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);

  if (hasError) {
    return (
      <div ref={wrapperRef} aria-hidden="true" className={`relative select-none overflow-visible ${className ?? ''}`} style={style} />
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', ...style }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Parium 3D-telefon"
        tabIndex={-1}
        className="relative h-full w-full cursor-grab bg-transparent outline-none transition-opacity duration-500 active:cursor-grabbing"
        draggable={false}
        style={{ colorScheme: 'normal', opacity: isReady ? 1 : 0, touchAction: 'none' }}
      />
    </div>
  );
};

export default SplinePhone;
