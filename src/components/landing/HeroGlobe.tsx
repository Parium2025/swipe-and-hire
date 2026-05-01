import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * HeroGlobe — Spline globe with a premium loading experience.
 *
 * Strategy (no permanent fallback — Spline always loads):
 * 1. Render a lightweight animated CSS "skeleton" orb instantly so the hero
 *    feels alive from the first paint and the layout never jumps.
 * 2. Lazy-mount the Spline iframe only when:
 *    - The hero is in (or near) the viewport (IntersectionObserver)
 *    - The browser is idle (requestIdleCallback) so it never blocks the
 *      entrance text animation
 *    - A short delay has elapsed so the heading finishes animating first
 * 3. When the iframe finishes loading, cross-fade smoothly from the skeleton
 *    to the real 3D globe.
 *
 * We honor prefers-reduced-motion by softening the entrance only — the
 * Spline asset still loads.
 */

const SPLINE_SRC =
  'https://my.spline.design/holographicearthwithdynamiclines-Pg5EiAtNq3hkwAdNMvB5pQAD/';

export const HeroGlobe = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoadSpline, setShouldLoadSpline] = useState(false);
  const [splineReady, setSplineReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    // Mobile/low-end devices get a slightly longer warm-up so the text
    // animation finishes before the heavy iframe boots.
    const isSmall = window.innerWidth < 640;
    const warmup = isSmall ? 1400 : 800;

    const triggerLoad = () => {
      if (cancelled) return;
      timeoutHandle = window.setTimeout(() => {
        if (cancelled) return;
        const w = window as any;
        if (typeof w.requestIdleCallback === 'function') {
          idleHandle = w.requestIdleCallback(
            () => !cancelled && setShouldLoadSpline(true),
            { timeout: 2500 },
          );
        } else {
          setShouldLoadSpline(true);
        }
      }, warmup);
    };

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
      observer.disconnect();
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (idleHandle && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleHandle);
      }
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
      <div className="relative h-[70vh] w-[70vh] max-h-[720px] max-w-[720px] sm:h-[75vh] sm:w-[75vh] lg:h-[80vh] lg:w-[80vh] lg:max-h-[860px] lg:max-w-[860px] overflow-hidden">
        {/* Lightweight CSS skeleton — always rendered first, cross-fades out when Spline is ready */}
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-[1600ms] ease-out ${
            splineReady ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.32),hsl(var(--secondary)/0.10)_38%,transparent_70%)] blur-2xl" />
          <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.18),transparent_60%)]" />
          <div className="absolute inset-[22%] rounded-full border border-secondary/20 [mask-image:radial-gradient(circle,black_60%,transparent)]" />
          <div className="absolute inset-[32%] rounded-full border border-secondary/15 animate-[spin_38s_linear_infinite] [mask-image:linear-gradient(135deg,black,transparent)]" />
          <div className="absolute inset-[42%] rounded-full border border-secondary/10 animate-[spin_52s_linear_infinite_reverse] [mask-image:linear-gradient(45deg,black,transparent)]" />
        </div>

        {/* Spline iframe — lazy mounted, always loads (no permanent fallback) */}
        {shouldLoadSpline && (
          <iframe
            src={SPLINE_SRC}
            className={`absolute inset-0 w-full border-0 transition-opacity duration-[1200ms] ease-out ${
              splineReady ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ height: 'calc(100% + 60px)' }}
            title="3D Earth"
            loading="lazy"
            // @ts-expect-error — fetchpriority is valid HTML
            fetchpriority="low"
            onLoad={() => setSplineReady(true)}
          />
        )}
      </div>
    </motion.div>
  );
};

export default HeroGlobe;
