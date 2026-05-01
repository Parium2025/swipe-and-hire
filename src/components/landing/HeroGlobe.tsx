import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * HeroGlobe — Spline "Particle AI Brain" with a premium loading experience.
 *
 * The scene is served exclusively through Spline's signed iframe (the raw
 * .splinecode bucket returns 403 to direct fetches), so we focus the
 * optimisation on the *experience*:
 *
 *  1. Preconnect + DNS-prefetch happen as early as possible so the iframe
 *     handshake is already warm by the time it starts loading.
 *  2. The iframe itself is mounted immediately but kept invisible so the
 *     browser begins downloading and warming the WebGL context in parallel
 *     with the hero text intro — no waiting for IntersectionObserver, which
 *     was causing the "loads only after scroll" feeling.
 *  3. A lightweight CSS skeleton is rendered behind it. We cross-fade only
 *     when the iframe has finished its first paint, so users never see a
 *     blank or jumping container.
 *  4. The scene is paused (via visibility) when the tab is hidden, saving
 *     battery and CPU on mobile.
 */

const SPLINE_EMBED_URL =
  'https://my.spline.design/particleaibrain-qOZru01HpsaDi218BLYF1WXA/';

export const HeroGlobe = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Warm the connection as early as possible — runs once on mount, before
  // the iframe even starts loading.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-parium-spline-warm="true"]')) return;
    const heads: HTMLLinkElement[] = [];
    for (const rel of ['preconnect', 'dns-prefetch'] as const) {
      for (const href of ['https://my.spline.design', 'https://prod.spline.design', 'https://unpkg.com']) {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        if (rel === 'preconnect') link.crossOrigin = 'anonymous';
        link.dataset.pariumSplineWarm = 'true';
        document.head.appendChild(link);
        heads.push(link);
      }
    }
    return () => {
      heads.forEach((l) => l.remove());
    };
  }, []);

  // Pause/resume the embedded scene when the tab visibility changes.
  useEffect(() => {
    const onVis = () => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage({ type: document.hidden ? 'spline:pause' : 'spline:play' }, '*');
      } catch {
        /* cross-origin iframe — ignore */
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Safety net: if onLoad never fires (rare CDN hiccups) we still reveal
  // the iframe after a generous timeout so the experience never gets stuck.
  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), 6500);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0.6 : 2.4,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.1,
      }}
    >
      {/*
        The wrapper is sized to fill the hero generously on desktop and stay
        comfortably contained on mobile. The overflow trick hides the Spline
        watermark by extending the iframe slightly past the bottom edge.
      */}
      <div className="relative h-[78vh] w-[78vh] max-h-[760px] max-w-[760px] overflow-hidden sm:h-[82vh] sm:w-[82vh] lg:h-[88vh] lg:w-[88vh] lg:max-h-[920px] lg:max-w-[920px]">
        {/* No skeleton — we let the hero background show through until the
            Spline scene has finished its first paint. This avoids the
            "fake globe appears then swaps" effect the user reported. */}

        {/* Spline iframe — mounted immediately, hidden until first paint.
            We oversize it (~112%) and shift it up-and-left so the
            "Built with Spline" badge in the bottom-right corner is pushed
            outside the wrapper's overflow-hidden area. No mask needed. */}
        <iframe
          ref={iframeRef}
          src={SPLINE_EMBED_URL}
          title="Particle AI Brain"
          loading="eager"
          // @ts-expect-error — fetchpriority is valid HTML
          fetchpriority="high"
          onLoad={() => {
            // Give Spline ~2 frames to flush its first WebGL paint before we
            // cross-fade — eliminates the visible "snap" some users reported.
            requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
          }}
          className={`absolute border-0 transition-opacity duration-[1200ms] ease-out [contain:layout_paint_size] ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            // Oversize symmetrically in width so the brain stays centered,
            // and shift up just enough that the bottom-right Spline badge
            // is pushed below the wrapper's clipped edge.
            width: '122%',
            height: '118%',
            top: '-12%',
            left: '-11%',
          }}
        />
      </div>
    </motion.div>
  );
};

export default HeroGlobe;
