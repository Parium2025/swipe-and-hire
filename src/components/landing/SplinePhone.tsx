import { useEffect, useRef, useState } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  zoom?: number;
  active?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

const getViewportFitZoom = (zoom: number) => {
  if (typeof window === 'undefined') return zoom;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const widthScale = width < 380 ? 0.42 : width < 480 ? 0.5 : width < 640 ? 0.58 : width < 768 ? 0.66 : width <= 1100 ? 0.74 : 1;
  const heightScale = height < 560 ? 0.7 : height < 620 ? 0.8 : height < 760 ? 0.92 : 1;

  return zoom * Math.min(widthScale, heightScale);
};

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
        app.setZoom(getViewportFitZoom(zoom));
        requestAnimationFrame(() => app?.setZoom(getViewportFitZoom(zoom)));
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
  }, [zoom]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !isReady) return;

    const applyZoom = () => app.setZoom(getViewportFitZoom(zoom));
    applyZoom();
    window.addEventListener('resize', applyZoom);
    window.addEventListener('orientationchange', applyZoom);

    return () => {
      window.removeEventListener('resize', applyZoom);
      window.removeEventListener('orientationchange', applyZoom);
    };
  }, [isReady, zoom]);

  if (hasError) {
    return (
      <div
        ref={wrapperRef}
        className={`relative flex items-center justify-center ${className ?? ''}`}
        role="img"
        aria-label="Parium 3D-telefon (statisk vy)"
      >
        <div className="aspect-[9/19] w-[58%] max-w-[260px] rounded-[2.25rem] border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.03] shadow-[0_30px_90px_hsl(var(--background)/0.5)] backdrop-blur-sm" />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
    >
      {/* Nödfallback — visas ENDAST om Spline-scenen inte kommit upp inom
          6 sekunder (långsamt nät, WebGL-fel, e.dyl.). Vid normal refresh
          syns den aldrig — canvasen fadar in när första frame är ritad. */}
      {showFallback && !isReady && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="relative aspect-[9/19] w-[58%] max-w-[260px] overflow-hidden rounded-[2.25rem] border border-white/10"
            style={{
              background:
                'linear-gradient(180deg, hsl(var(--background) / 0.55) 0%, hsl(var(--background) / 0.25) 100%)',
              boxShadow: '0 30px 90px hsl(var(--background) / 0.5)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(110deg, transparent 30%, hsl(var(--secondary) / 0.10) 50%, transparent 70%)',
                backgroundSize: '220% 100%',
                animation: 'parium-skeleton-shimmer 2.4s ease-in-out infinite',
              }}
            />
          </div>
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
        className="absolute left-1/2 top-1/2 h-[230%] w-[220%] -translate-x-1/2 -translate-y-1/2 cursor-grab bg-transparent outline-none transition-opacity duration-500 active:cursor-grabbing lg:h-[185%] lg:w-[190%]"
        draggable={false}
        style={{ colorScheme: 'normal', opacity: isReady ? 1 : 0, touchAction: 'none' }}
      />
    </div>
  );
};

export default SplinePhone;
