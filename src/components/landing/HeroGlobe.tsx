import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Application } from '@splinetool/runtime';
import splineSceneUrl from '@/assets/holographic-earth.scene.splinecode?url';

/**
 * HeroGlobe — Spline globe with a premium loading experience.
 *
 * Strategy (no permanent fallback — Spline always loads):
 * 1. Render a lightweight animated CSS "skeleton" orb instantly so the hero
 *    feels alive from the first paint and the layout never jumps.
 * 2. Load the Spline scene through @splinetool/runtime instead of an iframe.
 *    The public iframe document is ~5MB by itself and also loads the scene;
 *    direct runtime avoids that duplicate document and gives us lifecycle
 *    control, which prevents the animation from freezing after refresh.
 * 3. Cross-fade only after the runtime has started the real scene.
 *
 * We honor prefers-reduced-motion by softening the entrance only — the
 * Spline asset still loads.
 */

const SPLINE_EMBED_URL =
  'https://my.spline.design/holographicearthwithdynamiclines-Pg5EiAtNq3hkwAdNMvB5pQAD/';
const SPLINE_SCENE_URL = splineSceneUrl;

type LoadPhase = 'waiting' | 'loading' | 'ready' | 'fallback';

export const HeroGlobe = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('waiting');
  const prefersReducedMotion = useReducedMotion();
  const splineReady = loadPhase === 'ready';

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    let cancelled = false;
    let splineApp: Application | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let rafHandle: number | null = null;
    const abortController = new AbortController();

    const warmConnection = () => {
      if (document.querySelector('link[data-parium-spline-preconnect="true"]')) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://my.spline.design';
      link.crossOrigin = 'anonymous';
      link.dataset.pariumSplinePreconnect = 'true';
      document.head.appendChild(link);
    };

    const bootSpline = async () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      setLoadPhase('loading');

      try {
        const [{ Application }, sceneResponse] = await Promise.all([
          import('@splinetool/runtime'),
          fetch(SPLINE_SCENE_URL, {
            cache: 'force-cache',
            credentials: 'omit',
            mode: 'cors',
            signal: abortController.signal,
          }),
        ]);

        if (!sceneResponse.ok) throw new Error('Spline scene request failed');

        const sceneBuffer = await sceneResponse.arrayBuffer();
        if (cancelled) return;

        splineApp = new Application(canvas, { renderMode: 'continuous' });
        splineApp.start(sceneBuffer, { interactive: false });
        splineApp.setBackgroundColor('rgba(0, 3, 26, 0)');

        rafHandle = window.requestAnimationFrame(() => {
          rafHandle = window.requestAnimationFrame(() => {
            if (!cancelled) setLoadPhase('ready');
          });
        });
      } catch (error) {
        if (!cancelled && !abortController.signal.aborted) setLoadPhase('fallback');
      }
    };

    warmConnection();

    // Runtime loading is much lighter than the public iframe, so the warm-up
    // can be short while still keeping the first hero animation smooth.
    const isSmall = window.innerWidth < 640;
    const warmup = isSmall ? 650 : 350;

    const triggerLoad = () => {
      if (cancelled) return;
      timeoutHandle = window.setTimeout(() => {
        if (cancelled) return;
        const w = window as any;
        if (typeof w.requestIdleCallback === 'function') {
          idleHandle = w.requestIdleCallback(
            () => void bootSpline(),
            { timeout: isSmall ? 1200 : 800 },
          );
        } else {
          void bootSpline();
        }
      }, warmup);
    };

    const handleVisibility = () => {
      if (!splineApp) return;
      if (document.hidden) splineApp.stop();
      else splineApp.play();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            triggerLoad();
            break;
          }
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      abortController.abort();
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (rafHandle) cancelAnimationFrame(rafHandle);
      if (idleHandle && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleHandle);
      }
      splineApp?.dispose();
    };
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0.6 : 2.2,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.15,
      }}
    >
      <div className="relative h-[70vh] w-[70vh] max-h-[720px] max-w-[720px] overflow-hidden sm:h-[75vh] sm:w-[75vh] lg:h-[80vh] lg:w-[80vh] lg:max-h-[860px] lg:max-w-[860px]">
        {/* Lightweight CSS skeleton — always rendered first, cross-fades out when Spline is ready */}
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${
            splineReady ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute inset-[3%] rounded-full bg-[radial-gradient(circle_at_50%_42%,hsl(var(--secondary)/0.38),hsl(var(--secondary)/0.12)_36%,hsl(var(--background)/0.64)_66%,transparent_74%)] blur-2xl" />
          <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_46%_40%,hsl(var(--secondary)/0.24),hsl(var(--background)/0.72)_52%,hsl(var(--background)/0.92)_70%,transparent_73%)]" />
          <div className="absolute inset-[14%] rounded-full border border-secondary/20 opacity-70 [mask-image:radial-gradient(circle,black_58%,transparent_72%)]" />
          <div className="absolute inset-[20%] rounded-full border border-secondary/15 opacity-60 animate-[spin_44s_linear_infinite] [mask-image:linear-gradient(120deg,transparent,black_35%,black_64%,transparent)]" />
          <div className="absolute inset-[32%] rounded-full border border-secondary/10 opacity-50 animate-[spin_62s_linear_infinite_reverse] [mask-image:linear-gradient(35deg,black,transparent_70%)]" />
        </div>

        <canvas
          ref={canvasRef}
          aria-hidden
          className={`absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 scale-[1.165] transition-opacity duration-[900ms] ease-out [contain:layout_paint_size] sm:h-[88%] sm:w-[88%] sm:scale-[1.14] ${
            splineReady ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Emergency fallback only if direct runtime fails; normal path never uses iframe. */}
        {loadPhase === 'fallback' && (
          <iframe
            src={SPLINE_EMBED_URL}
            className="absolute inset-0 w-full border-0 opacity-100 transition-opacity duration-[1200ms] ease-out"
            style={{ height: 'calc(100% + 60px)' }}
            title="3D Earth"
            loading="lazy"
            // @ts-expect-error — fetchpriority is valid HTML
            fetchpriority="low"
          />
        )}
      </div>
    </motion.div>
  );
};

export default HeroGlobe;
