import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
  isEvening?: boolean;
}

type EffectType = 'rain' | 'rain_showers' | 'snow' | 'snow_showers' | 'thunder' | 'cloudy' | null;

const WeatherEffects = memo(({ weatherCode, isLoading, isEvening = false }: WeatherEffectsProps) => {
  // Determine effect type based on weather code
  const effectType = useMemo((): EffectType => {
    if (!weatherCode || isLoading) return null;
    
    // Cloudy: 3 (overcast)
    if (weatherCode === 3) {
      return 'cloudy';
    }
    // Rain showers: 80-82 (moderate, like current)
    if (weatherCode >= 80 && weatherCode <= 82) {
      return 'rain_showers';
    }
    // Regular rain: 51-67 (more visible drops)
    if (weatherCode >= 51 && weatherCode <= 67) {
      return 'rain';
    }
    // Snow showers: 85-86 (slightly faster)
    if (weatherCode >= 85 && weatherCode <= 86) {
      return 'snow_showers';
    }
    // Regular snow: 71-77 (gentle)
    if (weatherCode >= 71 && weatherCode <= 77) {
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
      {effectType === 'rain_showers' && <RainShowersEffect />}
      {effectType === 'snow' && <SnowEffect />}
      {effectType === 'snow_showers' && <SnowShowersEffect />}
      {effectType === 'thunder' && <ThunderEffect />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// Stars Effect - White dots like a night sky with occasional shooting star
const StarsEffect = memo(() => {
  const stars = useMemo(() => 
    Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 70, // Keep stars in upper portion
      size: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.5,
      twinkleDelay: Math.random() * 5,
      twinkleDuration: 2 + Math.random() * 3,
    })),
  []);

  // Shooting star state
  const [shootingStarActive, setShootingStarActive] = useState(false);

  useEffect(() => {
    const triggerShootingStar = () => {
      setShootingStarActive(true);
      
      // Hide after animation completes
      setTimeout(() => {
        setShootingStarActive(false);
      }, 600);
    };

    // Random interval between shooting stars (20-45 seconds)
    const scheduleNext = () => {
      const delay = 20000 + Math.random() * 25000;
      return setTimeout(() => {
        triggerShootingStar();
        scheduleNext();
      }, delay);
    };

    // First shooting star after 8-15 seconds
    const initialTimeout = setTimeout(triggerShootingStar, 8000 + Math.random() * 7000);
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

      {/* Shooting star - simple white dot from top-right going down-left */}
      {shootingStarActive && (
        <motion.div
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            right: '5%',
            top: '3%',
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0, 0.9, 0.9, 0.7, 0],
            x: [0, -200, -400],
            y: [0, 160, 320],
          }}
          transition={{
            duration: 1.2,
            ease: 'easeOut',
          }}
        />
      )}
    </>
  );
});

StarsEffect.displayName = 'StarsEffect';

// Cloudy Effect - Drifting clouds
const CloudyEffect = memo(() => {
  const clouds = useMemo(() => 
    Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      top: 5 + i * 18 + Math.random() * 10,
      size: 80 + Math.random() * 60,
      opacity: 0.06 + Math.random() * 0.04,
      duration: 60 + Math.random() * 40,
      delay: i * 8,
    })),
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
          animate={{
            x: ['-20vw', '120vw'],
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </>
  );
});

CloudyEffect.displayName = 'CloudyEffect';

// Rain Effect - Slanted with wind
const RainEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: (i / 35) * 120 - 10, // Start further left to account for wind drift
      delay: Math.random() * 3,
      duration: 1.2 + Math.random() * 0.6,
      height: 16 + Math.random() * 14,
      opacity: 0.35 + Math.random() * 0.25,
    })),
  []);

  return (
    <>
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-300/50 rounded-full"
          style={{
            left: `${drop.left}%`,
            top: -30,
            width: 2,
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
    </>
  );
});

RainEffect.displayName = 'RainEffect';

// Rain Showers Effect - Moderate with light wind
const RainShowersEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: (i / 28) * 115 - 5,
      delay: Math.random() * 4,
      duration: 1.5 + Math.random() * 0.8,
      height: 12 + Math.random() * 10,
      opacity: 0.25 + Math.random() * 0.2,
    })),
  []);

  return (
    <>
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-300/40 rounded-full"
          style={{
            left: `${drop.left}%`,
            top: -25,
            width: 1.5,
            height: drop.height,
            opacity: drop.opacity,
          }}
          animate={{
            y: ['0vh', '112vh'],
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

RainShowersEffect.displayName = 'RainShowersEffect';

// Snow Effect - Gentle and slow
const SnowEffect = memo(() => {
  const flakes = useMemo(() => 
    Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: (i / 20) * 100 + Math.random() * 5 - 2.5,
      delay: Math.random() * 8,
      duration: 12 + Math.random() * 8,
      size: 3 + Math.random() * 4,
      opacity: 0.3 + Math.random() * 0.25,
      swayAmount: 10 + Math.random() * 15,
    })),
  []);

  return (
    <>
      {flakes.map((flake) => (
        <motion.div
          key={flake.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${flake.left}%`,
            top: -15,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: 'blur(0.5px)',
          }}
          animate={{
            y: ['0vh', '105vh'],
            x: [0, flake.swayAmount, 0, -flake.swayAmount, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            repeat: Infinity,
            ease: 'linear',
            x: {
              duration: flake.duration * 0.6,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            },
          }}
        />
      ))}
    </>
  );
});

SnowEffect.displayName = 'SnowEffect';

// Snow Showers Effect - Slightly faster and more intense
const SnowShowersEffect = memo(() => {
  const flakes = useMemo(() => 
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: (i / 30) * 100 + Math.random() * 4 - 2,
      delay: Math.random() * 5,
      duration: 8 + Math.random() * 5,
      size: 3 + Math.random() * 5,
      opacity: 0.35 + Math.random() * 0.3,
      swayAmount: 12 + Math.random() * 18,
    })),
  []);

  return (
    <>
      {flakes.map((flake) => (
        <motion.div
          key={flake.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${flake.left}%`,
            top: -15,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: 'blur(0.5px)',
          }}
          animate={{
            y: ['0vh', '105vh'],
            x: [0, flake.swayAmount, 0, -flake.swayAmount, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            repeat: Infinity,
            ease: 'linear',
            x: {
              duration: flake.duration * 0.5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            },
          }}
        />
      ))}
    </>
  );
});

SnowShowersEffect.displayName = 'SnowShowersEffect';

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
