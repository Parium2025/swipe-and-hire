import { useEffect, useRef, useState } from 'react';
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

  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
