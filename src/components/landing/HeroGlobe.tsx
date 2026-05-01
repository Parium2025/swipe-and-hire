import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * HeroGlobe — Lazy-loaded, performance-optimized Spline globe.
 *
 * Strategy:
 * 1. Render a lightweight CSS placeholder immediately (no JS, no network).
 * 2. Skip the heavy Spline iframe entirely on:
 *    - Small mobile viewports (<640px)
 *    - prefers-reduced-motion
 *    - Save-Data header / slow connections (2g/3g)
 *    - Low device memory (<4GB)
 * 3. Otherwise, defer Spline until:
 *    - The hero section is intersecting the viewport
 *    - The browser is idle (requestIdleCallback)
 *    - A short delay has passed so the entrance text animation is smooth
 */

const SPLINE_SRC =
  'https://my.spline.design/holographicearthwithdynamiclines-Pg5EiAtNq3hkwAdNMvB5pQAD/';

function shouldUseLightweightFallback(): boolean {
  if (typeof window === 'undefined') return true;

  // Reduced motion preference
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;

  // Small viewport — Spline is too heavy for low-end mobiles
  if (window.innerWidth < 640) return true;

  // Save-Data / slow connection
  const conn = (navigator as any).connection;
  if (conn) {
    if (conn.saveData) return true;
    if (conn.effectiveType && /^(slow-2g|2g|3g)$/.test(conn.effectiveType)) return true;
  }

  // Low device memory
  const mem = (navigator as any).deviceMemory;
  if (typeof mem === 'number' && mem < 4) return true;

  return false;
}

export const HeroGlobe = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoadSpline, setShouldLoadSpline] = useState(false);
  const [splineReady, setSplineReady] = useState(false);
  const [useFallback] = useState(shouldUseLightweightFallback);

  useEffect(() => {
    if (useFallback) return;
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const triggerLoad = () => {
      if (cancelled) return;
      // Wait for the entrance text to finish first (~1.5s of staggered words)
      timeoutHandle = window.setTimeout(() => {
        if (cancelled) return;
        const w = window as any;
        if (typeof w.requestIdleCallback === 'function') {
          idleHandle = w.requestIdleCallback(() => setShouldLoadSpline(true), { timeout: 2500 });
        } else {
          setShouldLoadSpline(true);
        }
      }, 900);
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
      { rootMargin: '200px' },
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
  }, [useFallback]);

  return (
    <motion.div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.78 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
    >
      <div className="relative h-[70vh] w-[70vh] max-h-[720px] max-w-[720px] sm:h-[75vh] sm:w-[75vh] lg:h-[80vh] lg:w-[80vh] lg:max-h-[860px] lg:max-w-[860px] overflow-hidden">
        {/* Lightweight CSS placeholder — always rendered, fades when Spline takes over */}
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${
            splineReady ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.32),hsl(var(--secondary)/0.10)_38%,transparent_70%)] blur-2xl" />
          <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--secondary)/0.18),transparent_60%)]" />
          <div className="absolute inset-[22%] rounded-full border border-secondary/20 [mask-image:radial-gradient(circle,black_60%,transparent)]" />
          <div className="absolute inset-[32%] rounded-full border border-secondary/15 animate-[spin_38s_linear_infinite] [mask-image:linear-gradient(135deg,black,transparent)]" />
          <div className="absolute inset-[42%] rounded-full border border-secondary/10 animate-[spin_52s_linear_infinite_reverse] [mask-image:linear-gradient(45deg,black,transparent)]" />
        </div>

        {/* Spline iframe — only loaded when conditions are met */}
        {shouldLoadSpline && !useFallback && (
          <iframe
            src={SPLINE_SRC}
            className="absolute inset-0 w-full border-0"
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
