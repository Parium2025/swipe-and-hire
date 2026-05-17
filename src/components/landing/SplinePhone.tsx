import { useEffect, useRef, useState } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  zoom?: number;
  active?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

type RotatableSplineObject = {
  rotation: { x: number; y: number; z: number };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const findPhoneRotationTarget = (app: SplineApplication): RotatableSplineObject | null => {
  const byName = (name: string) => app.findObjectByName(name) as RotatableSplineObject | undefined;
  return byName('iPhone 14 Pro') ?? byName('Group') ?? null;
};

const getViewportFitZoom = (zoom: number) => {
  if (typeof window === 'undefined') return zoom;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const widthScale = width < 380 ? 0.28 : width < 480 ? 0.32 : width < 640 ? 0.4 : width < 768 ? 0.5 : width < 960 ? 0.56 : width <= 1100 ? 0.64 : 1;
  const heightScale = height < 560 ? 0.58 : height < 620 ? 0.66 : height < 760 ? 0.76 : height < 1040 ? 0.9 : 1;
  const tabletPreviewScale = width >= 640 && width < 1024 && height >= 780 ? 0.9 : 1;

  return zoom * Math.min(widthScale, heightScale) * tabletPreviewScale;
};

export const SplinePhone = ({ className, zoom = 0.78, active = true }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const rotationTargetRef = useRef<RotatableSplineObject | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
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
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const finishDrag = (event?: PointerEvent) => {
      const drag = dragStateRef.current;
      if (drag && event && wrapper.hasPointerCapture?.(drag.pointerId)) {
        try { wrapper.releasePointerCapture(drag.pointerId); } catch { /* no-op */ }
      }
      dragStateRef.current = null;
      wrapper.classList.remove('is-touch-rotating');
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const target = rotationTargetRef.current;
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      try { wrapper.setPointerCapture(event.pointerId); } catch { /* no-op */ }
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: target.rotation.x,
        baseY: target.rotation.y,
      };
      wrapper.classList.add('is-touch-rotating');
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      const target = rotationTargetRef.current;
      if (!drag || !target || drag.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      target.rotation.y = drag.baseY + dx * 0.008;
      target.rotation.x = clamp(drag.baseX + dy * 0.006, -0.55, 0.55);
      appRef.current?.requestRender?.();
    };

    const onPointerUp = (event: PointerEvent) => {
      event.stopPropagation();
      finishDrag(event);
    };

    const stopScrollFallback = (event: Event) => {
      if (dragStateRef.current) event.preventDefault();
      event.stopPropagation();
    };

    wrapper.addEventListener('pointerdown', onPointerDown, { passive: false });
    wrapper.addEventListener('pointermove', onPointerMove, { passive: false });
    wrapper.addEventListener('pointerup', onPointerUp, { passive: false });
    wrapper.addEventListener('pointercancel', onPointerUp, { passive: false });
    wrapper.addEventListener('touchstart', stopScrollFallback, { passive: false });
    wrapper.addEventListener('touchmove', stopScrollFallback, { passive: false });
    wrapper.addEventListener('touchend', stopScrollFallback, { passive: false });
    wrapper.addEventListener('touchcancel', stopScrollFallback, { passive: false });
    wrapper.addEventListener('wheel', stopScrollFallback, { passive: false });

    return () => {
      finishDrag();
      wrapper.removeEventListener('pointerdown', onPointerDown);
      wrapper.removeEventListener('pointermove', onPointerMove);
      wrapper.removeEventListener('pointerup', onPointerUp);
      wrapper.removeEventListener('pointercancel', onPointerUp);
      wrapper.removeEventListener('touchstart', stopScrollFallback);
      wrapper.removeEventListener('touchmove', stopScrollFallback);
      wrapper.removeEventListener('touchend', stopScrollFallback);
      wrapper.removeEventListener('touchcancel', stopScrollFallback);
      wrapper.removeEventListener('wheel', stopScrollFallback);
    };
  }, []);

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
              value: Math.min(window.devicePixelRatio || 1, isCoarsePointer() ? 1.35 : 2),
              configurable: true,
            });
          } catch {
            /* no-op */
          }
        }

        app = new Application(canvas, { renderMode: 'auto' });
        appRef.current = app;
        await app.load(SCENE_URL);
        app.setGlobalEvents(false);
        rotationTargetRef.current = findPhoneRotationTarget(app);
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
      rotationTargetRef.current = null;
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
      data-phone-interactive
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'none', overscrollBehavior: 'contain', pointerEvents: 'auto' }}
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
        className="pointer-events-none absolute left-1/2 top-1/2 h-[440%] w-[380%] -translate-x-1/2 -translate-y-1/2 cursor-grab bg-transparent outline-none transition-opacity duration-500 lg:h-[185%] lg:w-[190%]"
        draggable={false}
        style={{ colorScheme: 'normal', opacity: isReady ? 1 : 0, touchAction: 'none' }}
      />
    </div>
  );
};

export default SplinePhone;
