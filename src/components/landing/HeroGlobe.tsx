import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * HeroGlobe — Spline 3D phone scene.
 *
 * The phone scene needs a larger internal render viewport on narrow screens;
 * otherwise Spline crops the model at the top. We render the iframe larger and
 * scale it back down so the visible phone fits while the background still bleeds
 * to every edge.
 *
 * We keep:
 *  - preconnect/dns-prefetch warmup so the iframe handshake is hot before
 *    the browser starts loading it,
 *  - a visibility-based pause/play to save battery when the tab is hidden,
 *  - a fade-in on first paint so users never see a blank container,
 *  - a safety timeout in case onLoad never fires.
 */

const SPLINE_EMBED_URL =
  'https://my.spline.design/untitled-R9AE3iFR515l7EKvHCNavLb7/';

export const HeroGlobe = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Warm the connection as early as possible — runs once on mount.
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

  // Safety net: reveal after a generous timeout if onLoad never fires.
  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), 6500);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-0 z-0 overflow-hidden"
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0.6 : 2.4,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.1,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <iframe
          ref={iframeRef}
          src={SPLINE_EMBED_URL}
          title="Particle AI Brain"
          frameBorder={0}
          allow="autoplay"
          loading="eager"
          // @ts-expect-error — fetchpriority is valid HTML
          fetchpriority="high"
          allowTransparency={true}
          onLoad={() => {
            requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
          }}
          className={`[--phone-scale:0.82] [--phone-y:54%] transition-opacity duration-[1200ms] ease-out sm:[--phone-scale:0.9] sm:[--phone-y:52%] md:[--phone-scale:1] md:[--phone-y:50%] ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            position: 'absolute',
            top: 'var(--phone-y)',
            left: '50%',
            width: 'max(calc(100% / var(--phone-scale)), 560px)',
            height: 'max(calc((100% + 52px) / var(--phone-scale)), 760px)',
            transform: 'translate3d(-50%, -50%, 0) scale(var(--phone-scale))',
            transformOrigin: 'center center',
            border: 'none',
            background: 'transparent',
            display: 'block',
          }}
        />
      </div>
    </motion.div>
  );
};

export default HeroGlobe;
