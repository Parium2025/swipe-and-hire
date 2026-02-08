import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDevice } from '@/hooks/use-device';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
  isEvening?: boolean;
}

type EffectType = 'rain' | 'snow' | 'thunder' | 'cloudy' | null;

const WeatherEffects = memo(({ weatherCode, isLoading, isEvening = false }: WeatherEffectsProps) => {
  const device = useDevice();
  const isMobile = device === 'mobile';

  // Determine effect type based on weather code
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
      {showStars && <StarsEffect isMobile={isMobile} />}
      
      {effectType === 'cloudy' && <CloudyEffect isMobile={isMobile} />}
      {effectType === 'rain' && <RainEffect isMobile={isMobile} />}
      {effectType === 'snow' && <SnowEffect isMobile={isMobile} />}
      {effectType === 'thunder' && <ThunderEffect isMobile={isMobile} />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// Stars Effect - reduced count on mobile for performance
const STARS_CACHE_KEY = 'parium_stars_config';
const STARS_MOBILE_CACHE_KEY = 'parium_stars_config_mobile';

const getOrCreateStars = (isMobile: boolean) => {
  const cacheKey = isMobile ? STARS_MOBILE_CACHE_KEY : STARS_CACHE_KEY;
  const count = isMobile ? 20 : 50; // 60% fewer on mobile

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.length === count) return parsed;
    }
  } catch {}
  
  const stars = Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 70,
    size: 1 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.5,
    twinkleDelay: Math.random() * 5,
    twinkleDuration: 2 + Math.random() * 3,
  }));
  
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(stars));
  } catch {}
  
  return stars;
};

const StarsEffect = memo(({ isMobile }: { isMobile: boolean }) => {
  const stars = useMemo(() => getOrCreateStars(isMobile), [isMobile]);

  const [shootingStar, setShootingStar] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    size: number;
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
      // Longer intervals on mobile to reduce JS work
      const delay = isMobile 
        ? 40000 + Math.random() * 40000  
        : 25000 + Math.random() * 25000;
      return setTimeout(() => {
        triggerShootingStar();
        scheduleNext();
      }, delay);
    };

    const initialTimeout = setTimeout(triggerShootingStar, 10000 + Math.random() * 10000);
    const intervalId = scheduleNext();

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(intervalId);
    };
  }, [isMobile]);

  return (
    <>
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [star.opacity, star.opacity * 0.4, star.opacity],
          }}
          transition={{
            duration: star.twinkleDuration,
            delay: star.twinkleDelay,
            repeat: Infinity,
            ease: 'easeInOut',
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
          transition={{
            duration: 5,
            ease: 'linear',
          }}
        />
      )}
    </>
  );
});

StarsEffect.displayName = 'StarsEffect';


// Cloudy Effect - fewer clouds on mobile
const CloudyEffect = memo(({ isMobile }: { isMobile: boolean }) => {
  const count = isMobile ? 2 : 4;
  const clouds = useMemo(() => 
    Array.from({ length: count }).map((_, i) => {
      const duration = 60 + Math.random() * 40;
      const initialX = Math.random() * 140 - 20;
      return {
        id: i,
        top: 5 + i * 18 + Math.random() * 10,
        size: 80 + Math.random() * 60,
        opacity: 0.06 + Math.random() * 0.04,
        duration,
        initialX,
      };
    }),
  [count]);

  return (
    <>
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute bg-white rounded-full blur-3xl"
          style={{
            top: `${cloud.top}%`,
            width: cloud.size,
            height: cloud.size * 0.5,
            opacity: cloud.opacity,
          }}
          initial={{ x: `${cloud.initialX}vw` }}
          animate={{
            x: [`${cloud.initialX}vw`, '120vw', '-20vw', '120vw'],
          }}
          transition={{
            duration: cloud.duration,
            times: [0, (120 - cloud.initialX) / 140, (120 - cloud.initialX) / 140, 1],
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </>
  );
});

CloudyEffect.displayName = 'CloudyEffect';

// Rain Effect - fewer drops on mobile
const RainEffect = memo(({ isMobile }: { isMobile: boolean }) => {
  const count = isMobile ? 15 : 35;
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
        <motion.div
          key={drop.id}
          className="absolute bg-blue-300/50 rounded-full"
          style={{
            left: `${drop.left}%`,
            width: 2,
            height: drop.height,
            opacity: drop.opacity,
          }}
          initial={{ y: '-5vh' }}
          animate={{
            y: ['-5vh', '115vh'],
          }}
          transition={{
            duration: drop.duration,
            delay: drop.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </>
  );
});

RainEffect.displayName = 'RainEffect';


// Snow Effect - fewer flakes on mobile
const SnowEffect = memo(({ isMobile }: { isMobile: boolean }) => {
  const count = isMobile ? 18 : 40;
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
        <motion.div
          key={flake.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${flake.left}%`,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: 'blur(0.5px)',
          }}
          initial={{ y: '-5vh' }}
          animate={{
            y: ['-5vh', '105vh'],
            x: [0, flake.swayAmount, 0, -flake.swayAmount, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            y: {
              duration: flake.duration,
              delay: flake.delay,
              repeat: Infinity,
              ease: 'linear',
            },
            x: {
              duration: flake.duration * 0.5,
              delay: flake.delay,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            },
            rotate: {
              duration: flake.duration,
              delay: flake.delay,
              repeat: Infinity,
              ease: 'linear',
            },
          }}
        />
      ))}
    </>
  );
});

SnowEffect.displayName = 'SnowEffect';


// Thunder Effect - fewer rain drops on mobile
const ThunderEffect = memo(({ isMobile }: { isMobile: boolean }) => {
  const count = isMobile ? 18 : 40;
  const drops = useMemo(() => 
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: (i / count) * 130 - 15,
      delay: Math.random() * 3,
      duration: 1.0 + Math.random() * 0.5,
      height: 15 + Math.random() * 12,
      width: 2,
      opacity: 0.35 + Math.random() * 0.25,
    })),
  [count]);

  const [lightningState, setLightningState] = useState({
    position: 50,
    flash: false,
  });
  
  useEffect(() => {
    const flash = () => {
      const newPosition = 10 + Math.random() * 80;
      setLightningState({ position: newPosition, flash: true });
      setTimeout(() => setLightningState(s => ({ ...s, flash: false })), 100);
    };
    
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 5000;
      return setTimeout(() => {
        flash();
        scheduleNext();
      }, delay);
    };
    
    const initialTimeout = setTimeout(flash, 3000);
    const intervalId = scheduleNext();
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(intervalId);
    };
  }, []);

  return (
    <>
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-200/60 rounded-full"
          style={{
            left: `${drop.left}%`,
            top: -40,
            width: drop.width,
            height: drop.height,
            opacity: drop.opacity,
          }}
          animate={{
            y: ['0vh', '115vh'],
          }}
          transition={{
            duration: drop.duration,
            delay: drop.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
      
      {/* Lightning flash */}
      <motion.div
        className="absolute inset-0 bg-white/50 pointer-events-none"
        animate={{
          opacity: lightningState.flash ? 0.08 : 0,
        }}
        transition={{
          duration: 0.08,
        }}
      />
      
      {/* Single lightning bolt */}
      <motion.div
        className="absolute top-0"
        style={{ left: `${lightningState.position}%`, transform: 'translateX(-50%)' }}
        animate={{
          opacity: lightningState.flash ? 1 : 0,
          scale: lightningState.flash ? 1 : 0.8,
        }}
        transition={{
          duration: 0.05,
        }}
      >
        <svg width="16" height="45" viewBox="0 0 40 120" fill="none">
          <path
            d="M20 0L5 50H18L8 120L35 45H20L30 0H20Z"
            fill="rgba(255,255,255,0.7)"
            filter="drop-shadow(0 0 6px rgba(255,255,255,0.5))"
          />
        </svg>
      </motion.div>
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
