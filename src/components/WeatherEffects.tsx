import { memo, useMemo, useState, useEffect } from 'react';
import { getDevice } from '@/hooks/use-device';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
  isEvening?: boolean;
}

type EffectType = 'rain' | 'snow' | 'thunder' | 'cloudy' | null;

// Particle counts: reduced on mobile for scroll performance
const isMobileDevice = getDevice() === 'mobile';
const COUNTS = {
  stars: isMobileDevice ? 20 : 50,
  rain: isMobileDevice ? 15 : 35,
  snow: isMobileDevice ? 18 : 40,
  clouds: isMobileDevice ? 2 : 4,
  thunderRain: isMobileDevice ? 18 : 40,
};
// Shooting star interval: longer on mobile
const SHOOTING_STAR_MIN = isMobileDevice ? 40000 : 25000;
const SHOOTING_STAR_MAX = isMobileDevice ? 80000 : 50000;

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
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" style={{ contain: 'strict' }}>
      {showStars && <StarsEffect />}
      {effectType === 'cloudy' && <CloudyEffect />}
      {effectType === 'rain' && <RainEffect />}
      {effectType === 'snow' && <SnowEffect />}
      {effectType === 'thunder' && <ThunderEffect />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// Stars - pure CSS animations
const STARS_CACHE_KEY = 'parium_stars_config_v2'; // v2 = mobile-aware count

const getOrCreateStars = () => {
  const count = COUNTS.stars;
  try {
    const cached = sessionStorage.getItem(STARS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // If cached count matches current device, reuse
      if (parsed.length === count) return parsed;
    }
  } catch { /* ignore */ }

  const stars = Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 70,
    size: 1 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.5,
    twinkleDelay: Math.random() * 5,
    twinkleDuration: 2 + Math.random() * 3,
  }));

  try { sessionStorage.setItem(STARS_CACHE_KEY, JSON.stringify(stars)); } catch { /* ignore */ }
  return stars;
};

const StarsEffect = memo(() => {
  const stars = useMemo(() => getOrCreateStars(), []);

  const [shootingStar, setShootingStar] = useState<{
    key: number;
    startX: number;
    startY: number;
    size: number;
  } | null>(null);

  useEffect(() => {
    let counter = 0;
    const triggerShootingStar = () => {
      const startX = 5 + Math.random() * 40;
      const startY = 3 + Math.random() * 25;
      const size = 1 + Math.random() * 1.5;
      setShootingStar({ key: ++counter, startX, startY, size });
      setTimeout(() => setShootingStar(null), 5000);
    };

    const scheduleNext = () => {
      const delay = SHOOTING_STAR_MIN + Math.random() * (SHOOTING_STAR_MAX - SHOOTING_STAR_MIN);
      return setTimeout(() => { triggerShootingStar(); scheduleNext(); }, delay);
    };

    const initialTimeout = setTimeout(triggerShootingStar, 10000 + Math.random() * 10000);
    const intervalId = scheduleNext();
    return () => { clearTimeout(initialTimeout); clearTimeout(intervalId); };
  }, []);

  return (
    <>
      {stars.map((star) => (
        <div
          key={star.id}
          className="weather-star"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            '--star-opacity': star.opacity,
            '--twinkle-duration': `${star.twinkleDuration}s`,
            '--twinkle-delay': `${star.twinkleDelay}s`,
          } as React.CSSProperties}
        />
      ))}

      {shootingStar && (
        <div
          key={shootingStar.key}
          className="weather-shooting-star"
          style={{
            right: `${shootingStar.startX}%`,
            top: `${shootingStar.startY}%`,
            width: shootingStar.size,
            height: shootingStar.size,
          }}
        />
      )}
    </>
  );
});

StarsEffect.displayName = 'StarsEffect';

// Cloudy - pure CSS, reduced count on mobile
const CloudyEffect = memo(() => {
  const clouds = useMemo(() =>
    Array.from({ length: COUNTS.clouds }).map((_, i) => {
      const duration = 60 + Math.random() * 40;
      const initialX = Math.random() * 140 - 20;
      return {
        id: i,
        top: 5 + i * (70 / COUNTS.clouds) + Math.random() * 10,
        size: 80 + Math.random() * 60,
        opacity: 0.06 + Math.random() * 0.04,
        duration,
        initialX,
      };
    }),
  []);

  return (
    <>
      {clouds.map((cloud) => (
        <div
          key={cloud.id}
          className="weather-cloud"
          style={{
            top: `${cloud.top}%`,
            width: cloud.size,
            height: cloud.size * 0.5,
            opacity: cloud.opacity,
            '--cloud-start': `${cloud.initialX}vw`,
            '--cloud-duration': `${cloud.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
});

CloudyEffect.displayName = 'CloudyEffect';

// Rain - pure CSS, reduced count on mobile
const RainEffect = memo(() => {
  const count = COUNTS.rain;
  const drops = useMemo(() =>
    Array.from({ length: count }).map((_, i) => {
      const duration = 1.2 + Math.random() * 0.6;
      const staggerDelay = (i / count) * duration + Math.random() * 0.3;
      return {
        id: i,
        left: (i / count) * 120 - 10,
        duration,
        delay: staggerDelay,
        height: 16 + Math.random() * 14,
        opacity: 0.35 + Math.random() * 0.25,
      };
    }),
  [count]);

  return (
    <>
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="weather-raindrop bg-blue-300/50"
          style={{
            left: `${drop.left}%`,
            height: drop.height,
            opacity: drop.opacity,
            '--rain-duration': `${drop.duration}s`,
            '--rain-delay': `${drop.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
});

RainEffect.displayName = 'RainEffect';

// Snow - pure CSS, reduced count on mobile
const SnowEffect = memo(() => {
  const count = COUNTS.snow;
  const flakes = useMemo(() =>
    Array.from({ length: count }).map((_, i) => {
      const duration = 12 + Math.random() * 6;
      const staggerDelay = (i / count) * duration * 0.8 + Math.random() * 2;
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
  [count]);

  return (
    <>
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="weather-snowflake"
          style={{
            left: `${flake.left}%`,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            '--snow-duration': `${flake.duration}s`,
            '--snow-delay': `${flake.delay}s`,
            '--sway': `${flake.swayAmount}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
});

SnowEffect.displayName = 'SnowEffect';

// Thunder - pure CSS rain, minimal JS for lightning
const ThunderEffect = memo(() => {
  const count = COUNTS.thunderRain;
  const drops = useMemo(() =>
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: (i / count) * 130 - 15,
      delay: Math.random() * 3,
      duration: 1.0 + Math.random() * 0.5,
      height: 15 + Math.random() * 12,
      opacity: 0.35 + Math.random() * 0.25,
    })),
  [count]);

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
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="weather-raindrop bg-blue-200/60"
          style={{
            left: `${drop.left}%`,
            height: drop.height,
            opacity: drop.opacity,
            '--rain-duration': `${drop.duration}s`,
            '--rain-delay': `${drop.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Lightning flash overlay */}
      <div
        className="absolute inset-0 bg-white/50 pointer-events-none transition-opacity duration-[80ms]"
        style={{ opacity: lightningState.flash ? 0.08 : 0 }}
      />

      {/* Lightning bolt */}
      <div
        className="absolute top-0 transition-opacity duration-[50ms]"
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
