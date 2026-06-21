import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Smooth crossfade overlay when navigating between the landing pages
 * and the public SEO pages (jobb, yrke, kommun, guider…).
 *
 * Triggers on both forward navigation (clicking a footer link) and
 * back navigation (browser back / SEO back button). Does NOT trigger
 * for app/internal routes – only for the public landing ↔ SEO surface.
 */
const SEO_PREFIXES = [
  '/jobb',
  '/yrke',
  '/yrken',
  '/kommun',
  '/kommuner',
  '/guider',
  '/om-oss',
];

const LANDING_PATHS = new Set(['/', '/jobbsokare', '/arbetsgivare']);

const isSeo = (p: string) => SEO_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));
const isLanding = (p: string) => LANDING_PATHS.has(p);
const isPublic = (p: string) => isSeo(p) || isLanding(p);

const RouteTransitionOverlay = () => {
  const location = useLocation();
  const prevPath = useRef<string>(location.pathname);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const from = prevPath.current;
    const to = location.pathname;
    prevPath.current = to;
    if (from === to) return;
    if (!isPublic(from) || !isPublic(to)) return;

    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 30);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="route-transition"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-0 z-[9999] bg-[#0a1628]"
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
};

export default RouteTransitionOverlay;
