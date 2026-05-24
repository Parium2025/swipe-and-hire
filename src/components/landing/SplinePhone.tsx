import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';
import pariumRings from '@/assets/parium-logo-rings.png';

interface SplinePhoneProps {
  className?: string;
  style?: CSSProperties;
  zoom?: number;
  active?: boolean;
  instantFallback?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

const StaticPhoneFallback = ({ visible }: { visible: boolean }) => (
  <div
    aria-hidden="true"
    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
  >
    <div className="relative h-full aspect-[9/19.5] rounded-[2rem] border border-white/15 bg-black/70 p-[3.5%] shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)]">
      <div className="absolute left-1/2 top-[2.8%] h-[4.2%] w-[36%] -translate-x-1/2 rounded-full bg-black/80" />
      <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[1.55rem] border border-white/10 bg-[radial-gradient(circle_at_50%_40%,hsl(var(--secondary)/0.16),hsl(var(--background))_58%)]">
        <img src={pariumRings} alt="" className="w-[42%] max-w-[112px] object-contain opacity-95" draggable={false} />
        <span className="mt-3 text-[clamp(1rem,5vh,1.45rem)] font-semibold tracking-[0] text-foreground">Parium</span>
      </div>
    </div>
  </div>
);

export const SplinePhone = ({ className, style, zoom = 0.78, active = true, instantFallback = false }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const activeRef = useRef(active);
  const zoomRef = useRef(zoom);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (isReady || hasError) return;
    if (instantFallback) {
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
    const fire = () => window.dispatchEvent(new Event('parium:spline-ready'));
    if (!reducedMotion && !hasError && !showFallback) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(fire));
    return () => cancelAnimationFrame(id);
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
    })();

    return () => {
      cancelled = true;
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);

  if (hasError) {
    return (
      <div ref={wrapperRef} aria-hidden="true" className={`relative select-none overflow-visible ${className ?? ''}`} style={style}>
        <StaticPhoneFallback visible />
      </div>
    );
  }

  const showStaticFallback = !isReady && (instantFallback || showFallback);

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', ...style }}
    >
      <StaticPhoneFallback visible={showStaticFallback} />
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
