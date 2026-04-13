import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Starry night sky for the landing page – reuses the same logic
 * as the WeatherEffects StarsEffect but is always-on.
 */

const STARS_CACHE_KEY = 'parium_landing_stars';

const getOrCreateStars = () => {
  try {
    const cached = sessionStorage.getItem(STARS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  const stars = Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 80,
    size: 1 + Math.random() * 2,
    opacity: 0.25 + Math.random() * 0.45,
    twinkleDelay: Math.random() * 5,
    twinkleDuration: 2 + Math.random() * 3,
  }));
  try { sessionStorage.setItem(STARS_CACHE_KEY, JSON.stringify(stars)); } catch {}
  return stars;
};

const LandingStars = memo(() => {
  const stars = useMemo(() => getOrCreateStars(), []);

  const [shootingStar, setShootingStar] = useState<{
    active: boolean; startX: number; startY: number; size: number;
  } | null>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const triggerShootingStar = () => {
      const startX = 5 + Math.random() * 40;
      const startY = 3 + Math.random() * 25;
      const size = 1 + Math.random() * 1.5;
      setShootingStar({ active: true, startX, startY, size });
      const hideTimeout = setTimeout(() => setShootingStar(null), 5000);
      timeouts.push(hideTimeout);
    };
    const scheduleNext = () => {
      const delay = 20000 + Math.random() * 20000;
      const id = setTimeout(() => { triggerShootingStar(); scheduleNext(); }, delay);
      timeouts.push(id);
    };
    const initialTimeout = setTimeout(triggerShootingStar, 6000 + Math.random() * 8000);
    timeouts.push(initialTimeout);
    scheduleNext();
    return () => { timeouts.forEach(clearTimeout); };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute bg-white rounded-full animate-[twinkle_ease-in-out_infinite]"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDuration: `${star.twinkleDuration}s`,
            animationDelay: `${star.twinkleDelay}s`,
          }}
        />
      ))}

      {shootingStar?.active && (
        <motion.div
          className="absolute bg-white rounded-full"
          style={{
            right: `${shootingStar.startX}%`,
            top: `${shootingStar.startY}%`,
            width: shootingStar.size,
            height: shootingStar.size,
            boxShadow: '0 0 2px 0.5px rgba(255,255,255,0.5)',
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.7, 0.6, 0.5, 0.3, 0.1, 0],
            x: [0, -150, -350, -600, -900, -1200, -1500],
            y: [0, 100, 230, 400, 600, 800, 1000],
          }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      )}
    </div>
  );
});

LandingStars.displayName = 'LandingStars';

export default LandingStars;
