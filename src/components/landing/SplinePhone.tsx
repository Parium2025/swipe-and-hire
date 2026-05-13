import { useCallback, useEffect, useRef } from 'react';
import { Application } from '@splinetool/runtime';

interface SplinePhoneProps {
  className?: string;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

/**
 * Renderar Parium-telefonen som en interaktiv 3D-scen från Spline på en canvas.
 *
 * Interaktion:
 * När användaren håller/draggar på telefonen låses landningssidans scroll
 * tillfälligt, så gesten bara roterar modellen och inte flyttar bort hero-telefonen.
 */
export const SplinePhone = ({ className }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const lockedRootRef = useRef<HTMLElement | null>(null);
  const pointerInsideRef = useRef(false);
  const lockedScrollTopRef = useRef<number | null>(null);
  const previousOverflowRef = useRef<string>('');
  const previousTouchActionRef = useRef<string>('');

  const getScrollRoot = useCallback(
    () => wrapperRef.current?.closest<HTMLElement>('[data-landing-scroll-root]') ?? null,
    []
  );

  const stopPageScroll = useCallback((event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();

    const root = getScrollRoot();
    if (root && lockedScrollTopRef.current !== null) {
      root.scrollTop = lockedScrollTopRef.current;
    }
  }, [getScrollRoot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const app = new Application(canvas, { renderMode: 'continuous' });
    appRef.current = app;
    app.load(SCENE_URL).catch((error) => {
      console.error('Kunde inte ladda Spline-telefonen:', error);
    });

    return () => {
      app.dispose();
      appRef.current = null;
    };
  }, [stopPageScroll]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

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
  }, []);

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
      <canvas
        ref={canvasRef}
        title="Parium 3D-telefon"
        tabIndex={-1}
        className="h-full w-full bg-transparent outline-none"
        draggable={false}
        style={{ colorScheme: 'normal' }}
      />
    </div>
  );
};

export default SplinePhone;
