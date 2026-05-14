import { useEffect, useRef, useState } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
  zoom?: number;
  lockPageScroll?: boolean;
  resetToken?: number;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

export const SplinePhone = ({ className, zoom = 0.78, lockPageScroll = false, resetToken = 0 }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!lockPageScroll) return;
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper) return;

    const blockScroll = (event: WheelEvent | TouchEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const options = { passive: false, capture: true } as AddEventListenerOptions;
    wrapper.addEventListener('wheel', blockScroll, options);
    wrapper.addEventListener('touchmove', blockScroll, options);
    canvas?.addEventListener('wheel', blockScroll, options);
    canvas?.addEventListener('touchmove', blockScroll, options);

    return () => {
      wrapper.removeEventListener('wheel', blockScroll);
      wrapper.removeEventListener('touchmove', blockScroll);
      canvas?.removeEventListener('wheel', blockScroll);
      canvas?.removeEventListener('touchmove', blockScroll);
    };
  }, [lockPageScroll]);

  useEffect(() => {
    if (!resetToken || !appRef.current) return;
    const app = appRef.current as SplineApplication & {
      controls?: { reset?: () => void; update?: () => void };
      _controls?: { reset?: () => void; update?: () => void };
    };
    app.setZoom(zoom);
    (app.controls ?? app._controls)?.reset?.();
    (app.controls ?? app._controls)?.update?.();
    app.requestRender?.();
  }, [resetToken, zoom]);

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

        app = new Application(canvas, { renderMode: 'continuous' });
        appRef.current = app;
        await app.load(SCENE_URL);
        app.setZoom(zoom);
        requestAnimationFrame(() => app?.setZoom(zoom));
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
  }, [reducedMotion, zoom]);

  if (reducedMotion || hasError) {
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
      style={{ touchAction: lockPageScroll ? 'none' : 'pan-y', overscrollBehavior: 'contain' }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Parium 3D-telefon"
        tabIndex={-1}
        className="h-full w-full cursor-grab bg-transparent outline-none active:cursor-grabbing"
        draggable={false}
        style={{ colorScheme: 'normal', opacity: isReady ? 1 : 0, touchAction: 'none' }}
      />
    </div>
  );
};

export default SplinePhone;
