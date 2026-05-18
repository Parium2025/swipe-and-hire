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
  // showFallback = true ENDAST om Spline-scenen inte hunnit ladda inom 6s,
  // eller om laddningen failat. Vid normal refresh visas INGEN skeleton —
  // canvasen fade:as in tom (svart/transparent) tills första frame ritas.
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (isReady || hasError) return;
    const timer = window.setTimeout(() => setShowFallback(true), 6000);
    return () => window.clearTimeout(timer);
  }, [isReady, hasError]);

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
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: SplineApplication | null = null;

    (async () => {
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
    })();

    return () => {
      cancelled = true;
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);

  const StaticPhone = ({ shimmer = false }: { shimmer?: boolean }) => (
    <div
      className="relative aspect-[9/19] h-[82%] max-h-[320px] min-h-[188px] overflow-hidden rounded-[1.65rem] border border-white/20 bg-background/95 shadow-[0_24px_80px_hsl(var(--background)/0.55)] ring-1 ring-white/10"
      style={{ width: 'auto' }}
    >
      <div className="absolute -left-1 top-[18%] h-8 w-1 rounded-full bg-white/15" />
      <div className="absolute -left-1 top-[31%] h-11 w-1 rounded-full bg-white/15" />
      <div className="absolute -right-1 top-[25%] h-14 w-1 rounded-full bg-white/12" />
      <div className="absolute inset-[5px] overflow-hidden rounded-[1.35rem] border border-white/8 bg-primary">
        <div className="absolute left-1/2 top-2 h-[9px] w-10 -translate-x-1/2 rounded-full bg-background/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,hsl(var(--secondary)/0.16),transparent_38%)]" />
        <div className="absolute inset-x-0 top-[42%] flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white/78">
          <span className="relative inline-flex h-4 w-6 items-center">
            <span className="absolute left-0 h-3.5 w-3.5 rounded-full border-2 border-secondary/80" />
            <span className="absolute right-0 h-3.5 w-3.5 rounded-full border-2 border-secondary/80" />
          </span>
          Parium
        </div>
        <div className="absolute inset-x-6 bottom-5 h-1 rounded-full bg-white/12" />
        {shimmer && (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(110deg, transparent 30%, hsl(var(--secondary) / 0.10) 50%, transparent 70%)',
              backgroundSize: '220% 100%',
              animation: 'parium-skeleton-shimmer 2.4s ease-in-out infinite',
            }}
          />
        )}
      </div>
    </div>
  );

  if (reducedMotion || hasError) {
    return (
      <div
        ref={wrapperRef}
        className={`relative flex items-center justify-center ${className ?? ''}`}
        role="img"
        aria-label="Parium 3D-telefon (statisk vy)"
      >
        <StaticPhone />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
    >
      {/* Safari/iOS kan låta WebGL/Spline ladda länge utan tydligt fel.
          Visa därför en statisk telefon direkt under canvasen, så hero:n aldrig
          får ett tomt hål. När WebGL är redo fade:as canvasen in ovanpå. */}
      {!isReady && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <StaticPhone shimmer={showFallback} />
          <style>{`
            @keyframes parium-skeleton-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -120% 0; }
            }
          `}</style>
        </div>
      )}
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
