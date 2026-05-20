import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  style?: CSSProperties;
  zoom?: number;
  active?: boolean;
  instantFallback?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

// Avgör om enheten är för svag/uppkopplingen för dålig för att köra Spline.
// När detta är true visar vi enbart den statiska premium-ramen (samma fallback
// som redan används medan WebGL bootar) — inget försvinner visuellt.
const shouldSkipSpline = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  try {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const conn = nav.connection;
    if (conn?.saveData) return true;
    if (conn?.effectiveType && /(^|-)(2g|slow-2g|3g)$/i.test(conn.effectiveType)) return true;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 2) return true;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) {
      // Endast på touch/mobil — desktop med 4 kärnor klarar Spline fint.
      const isTouch = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
      if (isTouch) return true;
    }
  } catch {
    /* no-op */
  }
  return false;
};

export const SplinePhone = ({ className, style, zoom = 0.78, active = true, instantFallback = false }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const activeRef = useRef(active);

  // Beslutas en gång vid mount så vi inte flippar mellan WebGL ↔ fallback om
  // användaren råkar växla nätverk under sessionen.
  const skipSpline = useRef<boolean>(false);
  if (skipSpline.current === false && typeof window !== 'undefined') {
    skipSpline.current = shouldSkipSpline();
  }

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  // På mobil/surfplatta visar vi en premiumram direkt under laddning så hero aldrig
  // upplevs tom om WebGL/Spline är långsamt eller stoppas av mobilbrowsern.
  // På desktop väntar vi fortfarande några sekunder för att undvika skeleton-flash.
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (isReady || hasError) return;
    if (instantFallback || skipSpline.current) {
      setShowFallback(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowFallback(true), 6000);
    return () => window.clearTimeout(timer);
  }, [instantFallback, isReady, hasError]);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!reducedMotion && !hasError && !showFallback) return;
    window.dispatchEvent(new Event('parium:spline-ready'));
  }, [reducedMotion, hasError, showFallback]);


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
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (reducedMotion || skipSpline.current) return;

    let cancelled = false;
    let app: SplineApplication | null = null;
    let observer: IntersectionObserver | null = null;
    let started = false;

    const start = async () => {
      if (started || cancelled) return;
      started = true;
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
        // Spline-scenen kan ha en egen background-color som annars syns som
        // en vit ram innan WebGL fyller canvasen. Tvinga transparent.
        try {
          (app as unknown as { setBackgroundColor?: (c: string) => void })
            .setBackgroundColor?.('rgba(0,0,0,0)');
        } catch { /* no-op */ }
        app.setZoom(zoom);
        requestAnimationFrame(() => app?.setZoom(zoom));
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

    // Lazy-load: börja inte ladda runtime förrän canvasen är nära viewport.
    // På entry-points där hero är direkt synlig (t.ex. /jobbsokare) triggar
    // observern omedelbart, så ingen fördröjning för normala användare.
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              observer?.disconnect();
              observer = null;
              start();
              break;
            }
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(canvas);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);


  if (hasError) {
    // Offline / WebGL-fail: rendera ingenting hellre än en ful platshållartelefon.
    return <div ref={wrapperRef} aria-hidden="true" className={className} style={style} />;
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', ...style }}
    >
      {/* Ingen synlig laddnings-placeholder — hellre tomt än en ful platshållartelefon. */}
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
