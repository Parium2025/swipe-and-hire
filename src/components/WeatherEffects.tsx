import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
  isEvening?: boolean;
}

type EffectType = 'rain' | 'snow' | 'thunder' | 'cloudy' | null;

const WeatherEffects = memo(({ weatherCode, isLoading, isEvening = false }: WeatherEffectsProps) => {
  // Determine effect type based on weather code
  const effectType = useMemo((): EffectType => {
    if (!weatherCode || isLoading) return null;
    
    // Fog: 45, 48 - No visual effect, just cloud emoji
    // Cloudy: 3 (overcast)
    if (weatherCode === 3) {
      return 'cloudy';
    }
    // All rain types: 51-67 (drizzle/rain), 80-82 (showers)
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
      return 'rain';
    }
    // All snow types: 71-77 (snow), 85-86 (snow showers)
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
      return 'snow';
    }
    // Thunder: 95-99
    if (weatherCode >= 95 && weatherCode <= 99) {
      return 'thunder';
    }
    return null;
  }, [weatherCode, isLoading]);

  // Show stars at evening when clear or mostly clear (codes 0, 1, 2)
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

// Stars Effect - White dots like a night sky with occasional shooting star
// Stars are cached in sessionStorage to persist during navigation
const STARS_CACHE_KEY = 'parium_stars_config';

const getOrCreateStars = () => {
  try {
    const cached = sessionStorage.getItem(STARS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  
  // Generate new stars and cache them
  const stars = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 70,
    size: 1 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.5,
    twinkleDelay: Math.random() * 5,
    twinkleDuration: 2 + Math.random() * 3,
  }));
  
  try {
    sessionStorage.setItem(STARS_CACHE_KEY, JSON.stringify(stars));
  } catch {
    // Ignore storage errors
  }
  
  return stars;
};

const StarsEffect = memo(() => {
  // Use cached stars - same configuration persists for entire session
  const stars = useMemo(() => getOrCreateStars(), []);

  // Shooting star state with random start position
  const [shootingStar, setShootingStar] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    size: number;
  } | null>(null);

  useEffect(() => {
    const triggerShootingStar = () => {
      // Random start position in upper right area
      const startX = 5 + Math.random() * 40; // 5-45% from right
      const startY = 3 + Math.random() * 25; // 3-28% from top
      const size = 1 + Math.random() * 1.5; // Same size as stars (1-2.5px)
      
      setShootingStar({ active: true, startX, startY, size });
      
      // Hide after animation completes (5 seconds)
      setTimeout(() => {
        setShootingStar(null);
      }, 5000);
    };

    // Random interval between shooting stars (25-50 seconds)
    const scheduleNext = () => {
      const delay = 25000 + Math.random() * 25000;
      return setTimeout(() => {
        triggerShootingStar();
        scheduleNext();
      }, delay);
    };

    // First shooting star after 10-20 seconds
    const initialTimeout = setTimeout(triggerShootingStar, 10000 + Math.random() * 10000);
    const intervalId = scheduleNext();

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(intervalId);
    };
  }, []);

  return (
    <>
      {/* Static stars with subtle twinkle */}
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

      {/* Shooting star - tiny dot like the stars, flies across entire sky */}
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


// Cloudy Effect - Drifting clouds, appears already in progress
const CloudyEffect = memo(() => {
  const clouds = useMemo(() => 
    Array.from({ length: 4 }).map((_, i) => {
      const duration = 60 + Math.random() * 40;
      // Start clouds at random positions across the screen
      const initialX = Math.random() * 140 - 20; // -20vw to 120vw
      return {
        id: i,
        top: 5 + i * 18 + Math.random() * 10,
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

// Rain Effect - Continuous rain, always falling from top
const RainEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 35 }).map((_, i) => {
      const duration = 1.2 + Math.random() * 0.6;
      // Stagger start times so drops are distributed across the fall cycle
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


// Snow Effect - Continuous gentle snow, always falling from top
const SnowEffect = memo(() => {
  const flakes = useMemo(() => 
    Array.from({ length: 40 }).map((_, i) => {
      const duration = 12 + Math.random() * 6; // 12-18 seconds to fall
      // Stagger start times so flakes are distributed across the fall cycle
      // This creates the illusion of continuous snow without "popping"
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
          initial={{ y: '-5vh' }} // Always start above viewport
          animate={{
            y: ['-5vh', '105vh'], // Fall from top to bottom
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


// Thunder Effect - Single lightning bolt at random position
const ThunderEffect = memo(() => {
  // Rain drops - moderate intensity with strong wind
  const drops = useMemo(() => 
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: (i / 40) * 130 - 15, // Start further left for wind drift
      delay: Math.random() * 3,
      duration: 1.0 + Math.random() * 0.5,
      height: 15 + Math.random() * 12,
      width: 2,
      opacity: 0.35 + Math.random() * 0.25,
    })),
  []);

  // Single lightning bolt with random position
  const [lightningState, setLightningState] = useState({
    position: 50,
    flash: false,
  });
  
  useEffect(() => {
    // Create lightning flash
    const flash = () => {
      // Random position for this flash
      const newPosition = 10 + Math.random() * 80;
      
      // Flash
      setLightningState({ position: newPosition, flash: true });
      
      // Quick off
      setTimeout(() => setLightningState(s => ({ ...s, flash: false })), 100);
    };
    
    // Variable interval between lightning strikes (5-10 seconds)
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 5000;
      return setTimeout(() => {
        flash();
        scheduleNext();
      }, delay);
    };
    
    // Initial flash after longer delay
    const initialTimeout = setTimeout(flash, 3000);
    const intervalId = scheduleNext();
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(intervalId);
    };
  }, []);

  return (
    <>
      {/* Rain with strong wind */}
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
      
      {/* Lightning flash - very subtle screen flash */}
      <motion.div
        className="absolute inset-0 bg-white/50 pointer-events-none"
        animate={{
          opacity: lightningState.flash ? 0.08 : 0,
        }}
        transition={{
          duration: 0.08,
        }}
      />
      
      {/* Single lightning bolt at random position */}
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
