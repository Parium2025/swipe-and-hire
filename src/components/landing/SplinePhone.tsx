import { useEffect, useRef } from 'react';
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
  const previousOverflowRef = useRef<string>('');
  const previousTouchActionRef = useRef<string>('');

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
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const preventPageScroll = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    wrapper.addEventListener('wheel', preventPageScroll, { passive: false });
    wrapper.addEventListener('touchmove', preventPageScroll, { passive: false });

    return () => {
      wrapper.removeEventListener('wheel', preventPageScroll);
      wrapper.removeEventListener('touchmove', preventPageScroll);
    };
  }, []);

  const unlockScroll = () => {
    const root = lockedRootRef.current;
    if (!root) return;

    root.style.overflowY = previousOverflowRef.current;
    root.style.touchAction = previousTouchActionRef.current;
    lockedRootRef.current = null;
  };

  const lockScrollForRotation = () => {
    const root = wrapperRef.current?.closest<HTMLElement>('[data-landing-scroll-root]');
    if (!root || lockedRootRef.current) return;

    lockedRootRef.current = root;
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
