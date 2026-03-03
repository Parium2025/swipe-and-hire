import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
  isEvening?: boolean;
}

type EffectType = 'rain' | 'snow' | 'thunder' | 'cloudy' | null;

const WeatherEffects = memo(({ weatherCode, isLoading, isEvening = false }: WeatherEffectsProps) => {
  const effectType = useMemo((): EffectType => {
    if (!weatherCode || isLoading) return null;
    if (weatherCode === 3) return 'cloudy';
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return 'rain';
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) return 'snow';
    if (weatherCode >= 95 && weatherCode <= 99) return 'thunder';
    return null;
  }, [weatherCode, isLoading]);

  const showStars = isEvening && (weatherCode === 0 || weatherCode === 1 || weatherCode === 2);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {showStars && <StarsEffect />}
      {effectType === 'cloudy' && <CloudyEffect />}
      {effectType === 'rain' && <RainEffect />}
      {effectType === 'snow' && <SnowEffect />}
      {effectType === 'thunder' && <ThunderEffect />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// ─── Stars: CSS twinkle + JS shooting star ───────────────────────────────────

const STARS_CACHE_KEY = 'parium_stars_config';

const getOrCreateStars = () => {
  try {
    const cached = sessionStorage.getItem(STARS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  const stars = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 70,
    size: 1 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.5,
    twinkleDelay: Math.random() * 5,
    twinkleDuration: 2 + Math.random() * 3,
  }));
  try { sessionStorage.setItem(STARS_CACHE_KEY, JSON.stringify(stars)); } catch {}
  return stars;
};

const StarsEffect = memo(() => {
  const stars = useMemo(() => getOrCreateStars(), []);

  const [shootingStar, setShootingStar] = useState<{
    active: boolean; startX: number; startY: number; size: number;
  } | null>(null);

  useEffect(() => {
    const triggerShootingStar = () => {
      const startX = 5 + Math.random() * 40;
      const startY = 3 + Math.random() * 25;
      const size = 1 + Math.random() * 1.5;
      setShootingStar({ active: true, startX, startY, size });
      setTimeout(() => setShootingStar(null), 5000);
    };
    const scheduleNext = () => {
      const delay = 25000 + Math.random() * 25000;
      return setTimeout(() => { triggerShootingStar(); scheduleNext(); }, delay);
    };
    const initialTimeout = setTimeout(triggerShootingStar, 10000 + Math.random() * 10000);
    const intervalId = scheduleNext();
    return () => { clearTimeout(initialTimeout); clearTimeout(intervalId); };
  }, []);

  return (
    <>
      {/* CSS-animated twinkle stars — no framer-motion overhead */}
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

      {/* Shooting star — uses framer-motion (only 1 element, complex path) */}
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
    </>
  );
});

StarsEffect.displayName = 'StarsEffect';

// ─── Clouds: CSS drift ───────────────────────────────────────────────────────

const CloudyEffect = memo(() => {
  const clouds = useMemo(() =>
    Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      top: 5 + i * 18 + Math.random() * 10,
      size: 80 + Math.random() * 60,
      opacity: 0.06 + Math.random() * 0.04,
      duration: 60 + Math.random() * 40,
      initialOffset: Math.random() * 100,
    })),
  []);

  return (
    <>
      {clouds.map((cloud) => (
        <div
          key={cloud.id}
          className="absolute bg-white rounded-full blur-3xl animate-[cloudDrift_linear_infinite]"
          style={{
            top: `${cloud.top}%`,
            width: cloud.size,
            height: cloud.size * 0.5,
            opacity: cloud.opacity,
            animationDuration: `${cloud.duration}s`,
            animationDelay: `-${cloud.initialOffset / 100 * cloud.duration}s`,
          }}
        />
      ))}
    </>
  );
});

CloudyEffect.displayName = 'CloudyEffect';

// ─── Rain: CSS falling drops ────────────────────────────────────────────────

const RainEffect = memo(() => {
  const drops = useMemo(() =>
    Array.from({ length: 35 }).map((_, i) => {
      const duration = 1.2 + Math.random() * 0.6;
      const staggerDelay = (i / 35) * duration + Math.random() * 0.3;
      return {
        id: i,
        left: (i / 35) * 120 - 10,
        duration,
        delay: staggerDelay,
        height: 16 + Math.random() * 14,
        opacity: 0.35 + Math.random() * 0.25,
      };
    }),
  []);

  return (
    <>
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute bg-blue-300/50 rounded-full animate-[rainFall_linear_infinite]"
          style={{
            left: `${drop.left}%`,
            width: 2,
            height: drop.height,
            opacity: drop.opacity,
            animationDuration: `${drop.duration}s`,
            animationDelay: `${drop.delay}s`,
          }}
        />
      ))}
    </>
  );
});

RainEffect.displayName = 'RainEffect';

// ─── Snow: CSS falling + sway ───────────────────────────────────────────────

const SnowEffect = memo(() => {
  const flakes = useMemo(() =>
    Array.from({ length: 40 }).map((_, i) => {
      const duration = 12 + Math.random() * 6;
      const staggerDelay = (i / 40) * duration * 0.8 + Math.random() * 2;
      return {
        id: i,
        left: Math.random() * 100,
        delay: staggerDelay,
        duration,
        size: 3 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.25,
        swayAmount: 10 + Math.random() * 15,
      };
    }),
  []);

  return (
    <>
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute bg-white rounded-full animate-[snowFall_linear_infinite]"
          style={{
            left: `${flake.left}%`,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: 'blur(0.5px)',
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            // CSS custom prop for sway amount
            '--sway': `${flake.swayAmount}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
});

SnowEffect.displayName = 'SnowEffect';

// ─── Thunder: CSS rain + JS lightning flash ─────────────────────────────────

const ThunderEffect = memo(() => {
  const drops = useMemo(() =>
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: (i / 40) * 130 - 15,
      delay: Math.random() * 3,
      duration: 1.0 + Math.random() * 0.5,
      height: 15 + Math.random() * 12,
      opacity: 0.35 + Math.random() * 0.25,
    })),
  []);

  const [lightningState, setLightningState] = useState({ position: 50, flash: false });

  useEffect(() => {
    const flash = () => {
      const newPosition = 10 + Math.random() * 80;
      setLightningState({ position: newPosition, flash: true });
      setTimeout(() => setLightningState(s => ({ ...s, flash: false })), 100);
    };
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 5000;
      return setTimeout(() => { flash(); scheduleNext(); }, delay);
    };
    const initialTimeout = setTimeout(flash, 3000);
    const intervalId = scheduleNext();
    return () => { clearTimeout(initialTimeout); clearTimeout(intervalId); };
  }, []);

  return (
    <>
      {/* CSS rain drops */}
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute bg-blue-200/60 rounded-full animate-[rainFall_linear_infinite]"
          style={{
            left: `${drop.left}%`,
            top: -40,
            width: 2,
            height: drop.height,
            opacity: drop.opacity,
            animationDuration: `${drop.duration}s`,
            animationDelay: `${drop.delay}s`,
          }}
        />
      ))}

      {/* Lightning flash — only 2 elements, kept as inline styles for simplicity */}
      <div
        className="absolute inset-0 bg-white/50 pointer-events-none transition-opacity duration-75"
        style={{ opacity: lightningState.flash ? 0.08 : 0 }}
      />
      <div
        className="absolute top-0 transition-opacity duration-50"
        style={{
          left: `${lightningState.position}%`,
          transform: 'translateX(-50%)',
          opacity: lightningState.flash ? 1 : 0,
        }}
      >
        <svg width="16" height="45" viewBox="0 0 40 120" fill="none">
          <path
            d="M20 0L5 50H18L8 120L35 45H20L30 0H20Z"
            fill="rgba(255,255,255,0.7)"
            filter="drop-shadow(0 0 6px rgba(255,255,255,0.5))"
          />
        </svg>
      </div>
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
