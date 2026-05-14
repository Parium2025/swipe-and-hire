import { useCallback, useEffect, useRef, useState } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

/**
 * Produktionsklar Spline-telefon.
 *
 * Optimeringar:
 * - Lazy load via IntersectionObserver (Spline-runtime ~400KB laddas först när man når sektionen)
 * - `prefers-reduced-motion`: fallback utan 3D
 * - Loading-skeleton tills scenen är redo
 * - DPR-clamp till 2 (sparar GPU på Retina)
 * - Scroll-lås när användaren drar/roterar telefonen — sidan rör sig inte
 * - A11y: aria-label på canvas
 */
export const SplinePhone = ({ className }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const lockedRootRef = useRef<HTMLElement | null>(null);
  const pointerInsideRef = useRef(false);
  const lockedScrollTopRef = useRef<number | null>(null);
  const previousOverflowRef = useRef<string>('');
  const previousTouchActionRef = useRef<string>('');

  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const getScrollRoot = useCallback(
    () => wrapperRef.current?.closest<HTMLElement>('[data-landing-scroll-root]') ?? null,
    []
  );

  const stopPageScroll = useCallback(
    (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();
      const root = getScrollRoot();
      if (root && lockedScrollTopRef.current !== null) {
        root.scrollTop = lockedScrollTopRef.current;
      }
    },
    [getScrollRoot]
  );

  // Lazy-load: börja ladda Spline först när telefonen är synlig
  useEffect(() => {
    if (reducedMotion) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [reducedMotion]);

  // Ladda Spline-runtime + scenen
  useEffect(() => {
    if (!shouldLoad || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: SplineApplication | null = null;

    (async () => {
      try {
        const { Application } = await import('@splinetool/runtime');
        if (cancelled) return;

        // DPR-clamp för bättre prestanda på Retina
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
  }, [shouldLoad, reducedMotion]);

  // Scroll-block när pekaren är över telefonen
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || reducedMotion) return;

    const shouldBlock = (event: Event) => {
      const path = 'composedPath' in event ? event.composedPath() : [];
      return pointerInsideRef.current || path.includes(wrapper);
    };
    const preventScrollBeforeLenis = (event: Event) => {
      if (shouldBlock(event)) stopPageScroll(event);
    };

    wrapper.addEventListener('wheel', stopPageScroll, { passive: false, capture: true });
    wrapper.addEventListener('touchmove', stopPageScroll, { passive: false, capture: true });
    document.addEventListener('wheel', preventScrollBeforeLenis, { passive: false, capture: true });
    document.addEventListener('touchmove', preventScrollBeforeLenis, { passive: false, capture: true });

    return () => {
      wrapper.removeEventListener('wheel', stopPageScroll, true);
      wrapper.removeEventListener('touchmove', stopPageScroll, true);
      document.removeEventListener('wheel', preventScrollBeforeLenis, true);
      document.removeEventListener('touchmove', preventScrollBeforeLenis, true);
    };
  }, [stopPageScroll, reducedMotion]);

  const unlockScroll = () => {
    const root = lockedRootRef.current;
    if (!root) return;
    root.style.overflowY = previousOverflowRef.current;
    root.style.touchAction = previousTouchActionRef.current;
    lockedRootRef.current = null;
    lockedScrollTopRef.current = null;
  };

  const lockScrollForRotation = () => {
    const root = getScrollRoot();
    if (!root || lockedRootRef.current) return;
    lockedRootRef.current = root;
    lockedScrollTopRef.current = root.scrollTop;
    previousOverflowRef.current = root.style.overflowY;
    previousTouchActionRef.current = root.style.touchAction;
    root.style.overflowY = 'hidden';
    root.style.touchAction = 'none';
    window.addEventListener('pointerup', unlockScroll, { once: true });
    window.addEventListener('pointercancel', unlockScroll, { once: true });
  };

  // Reduced-motion eller fel: visa enkel statisk platshållare
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
      data-lenis-prevent
      data-lenis-prevent-wheel
      data-lenis-prevent-touch
      className={`relative ${className ?? ''}`}
      onPointerEnter={() => {
        pointerInsideRef.current = true;
        lockedScrollTopRef.current = getScrollRoot()?.scrollTop ?? null;
      }}
      onPointerLeave={() => {
        pointerInsideRef.current = false;
        if (!lockedRootRef.current) lockedScrollTopRef.current = null;
      }}
      onPointerDown={lockScrollForRotation}
      onPointerUp={unlockScroll}
      onPointerCancel={unlockScroll}
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      {/* Loading-skeleton tills Spline är klar */}
      {!isReady && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="aspect-[9/19] w-[58%] max-w-[260px] animate-pulse rounded-[2.25rem] border border-white/10 bg-white/[0.04]" />
        </div>
      )}

      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interaktiv 3D-telefon. Klicka och dra för att rotera."
        tabIndex={-1}
        className="h-full w-full bg-transparent outline-none transition-opacity duration-500"
        draggable={false}
        style={{ colorScheme: 'normal', opacity: isReady ? 1 : 0 }}
      />
    </div>
  );
};

export default SplinePhone;
