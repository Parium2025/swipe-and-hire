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
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: prefersReducedMotion ? 0.4 : 1.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Premium ambient glow that fades in behind the phone */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.6 }}
        transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        style={{
          width: 'min(720px, 90%)',
          height: 'min(720px, 90%)',
          background:
            'radial-gradient(circle at center, hsl(var(--primary) / 0.35) 0%, hsl(var(--primary) / 0.12) 35%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Phone wrapper — animates in with a premium float + scale */}
      <motion.div
        className="relative w-full h-full pointer-events-auto"
        initial={{
          opacity: 0,
          y: prefersReducedMotion ? 0 : 60,
          scale: prefersReducedMotion ? 1 : 0.85,
          rotateX: prefersReducedMotion ? 0 : 12,
        }}
        animate={{
          opacity: ready ? 1 : 0,
          y: ready ? 0 : 60,
          scale: ready ? 1 : 0.85,
          rotateX: ready ? 0 : 12,
        }}
        transition={{
          duration: prefersReducedMotion ? 0.6 : 2.4,
          ease: [0.16, 1, 0.3, 1],
          delay: 0.3,
        }}
        style={{
          perspective: 1200,
          transformStyle: 'preserve-3d',
          overflow: 'hidden',
        }}
      >
        <iframe
          ref={iframeRef}
          src={SPLINE_EMBED_URL}
          title="3D Phone"
          frameBorder={0}
          allow="autoplay; xr-spatial-tracking"
          loading="eager"
          // @ts-expect-error — fetchpriority is valid HTML
          fetchpriority="high"
          allowTransparency={true}
          onLoad={() => {
            requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
          }}
          className="[--phone-scale:0.82] [--phone-y:49%] max-[360px]:[--phone-scale:0.6] max-[360px]:[--phone-y:54%] sm:[--phone-scale:0.9] sm:[--phone-y:50%] md:[--phone-scale:1]"
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
            // Ensure touch gestures rotate the phone instead of scrolling the page
            touchAction: 'none',
            pointerEvents: 'auto',
          }}
        />
      </motion.div>
    </motion.div>
  );
};

export default HeroGlobe;
