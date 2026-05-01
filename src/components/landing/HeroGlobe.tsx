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
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0.6 : 2.4,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.1,
      }}
    >
      <div className="parium-brain-stage absolute inset-0 overflow-hidden">
        <div className="parium-brain-particles parium-brain-particles-back" />
        <iframe
          ref={iframeRef}
          src={SPLINE_EMBED_URL}
          title="Particle AI Brain"
          loading="eager"
          // @ts-expect-error — fetchpriority is valid HTML
          fetchpriority="high"
          onLoad={() => {
            requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
          }}
          className={`parium-brain-iframe absolute left-1/2 top-1/2 border-0 transition-opacity duration-[1200ms] ease-out [contain:layout_paint_size] ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            width: 'var(--brain-scene-size, 260%)',
            height: 'calc(var(--brain-scene-size, 260%) * 1.12)',
            transform: 'translate(-50%, -50%) translateY(var(--brain-y, 4%))',
          }}
        />
        <div className="parium-brain-particles parium-brain-particles-front" />
        <style>{`
          .parium-brain-stage {
            background:
              radial-gradient(circle at 50% 44%, hsl(var(--secondary) / 0.22), transparent 42%),
              linear-gradient(180deg, hsl(var(--background) / 0.2), hsl(var(--background) / 0.78));
          }

          .parium-brain-particles {
            position: absolute;
            inset: -14%;
            background-image:
              radial-gradient(circle, hsl(var(--secondary) / 0.78) 0 1px, transparent 1.8px),
              radial-gradient(circle, hsl(var(--primary) / 0.5) 0 1.5px, transparent 2.4px),
              radial-gradient(circle, hsl(var(--foreground) / 0.34) 0 1px, transparent 2px);
            background-size: 27px 27px, 49px 49px, 81px 81px;
            background-position: 0 0, 17px 23px, 34px 12px;
            opacity: 0.52;
            animation: parium-particles-rise 20s linear infinite;
          }

          .parium-brain-particles-back {
            filter: blur(0.2px);
          }

          .parium-brain-particles-front {
            opacity: 0.28;
            animation-duration: 15s;
            -webkit-mask-image: radial-gradient(ellipse at 50% 54%, transparent 0 31%, black 50% 100%);
            mask-image: radial-gradient(ellipse at 50% 54%, transparent 0 31%, black 50% 100%);
          }

          @keyframes parium-particles-rise {
            from { transform: translate3d(0, 5%, 0); }
            to { transform: translate3d(0, -5%, 0); }
          }

          @media (min-width: 640px) {
            .parium-brain-stage .parium-brain-iframe {
              --brain-scene-size: 100%;
              --brain-y: 0%;
            }

            .parium-brain-particles {
              display: none;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .parium-brain-particles { animation: none; }
          }
        `}</style>
      </div>
    </motion.div>
  );
};

export default HeroGlobe;
