import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * HeroGlobe — Spline "Particle AI Brain".
 *
 * Minimal wrapper around the Spline iframe, matching the reference
 * ParticleBrain implementation exactly (full width/height with a +52px
 * height bleed to hide Spline's bottom watermark). No transforms or
 * scaling — the scene fills its container natively on every screen size.
 *
 * We keep:
 *  - preconnect/dns-prefetch warmup so the iframe handshake is hot before
 *    the browser starts loading it,
 *  - a visibility-based pause/play to save battery when the tab is hidden,
 *  - a fade-in on first paint so users never see a blank container,
 *  - a safety timeout in case onLoad never fires.
 */

const SPLINE_EMBED_URL =
  'https://my.spline.design/particleaibrain-qOZru01HpsaDi218BLYF1WXA/';

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
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
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
          allowTransparent
          onLoad={() => {
            requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
          }}
          className={`transition-opacity duration-[1200ms] ease-out ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 'calc(100% + 52px)',
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
