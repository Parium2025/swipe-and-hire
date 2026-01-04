import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
}

type EffectType = 'rain' | 'rain_showers' | 'snow' | 'snow_showers' | 'thunder' | null;

const WeatherEffects = memo(({ weatherCode, isLoading }: WeatherEffectsProps) => {
  // Determine effect type based on weather code
  const effectType = useMemo((): EffectType => {
    if (!weatherCode || isLoading) return null;
    
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

  if (!effectType) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {effectType === 'rain' && <RainEffect />}
      {effectType === 'rain_showers' && <RainShowersEffect />}
      {effectType === 'snow' && <SnowEffect />}
      {effectType === 'snow_showers' && <SnowShowersEffect />}
      {effectType === 'thunder' && <ThunderEffect />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// Rain Effect - More visible drops
const RainEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: (i / 30) * 100 + Math.random() * 4 - 2,
      delay: Math.random() * 4,
      duration: 1.5 + Math.random() * 1,
      height: 14 + Math.random() * 12,
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
            top: -20,
            width: 2,
            height: drop.height,
            opacity: drop.opacity,
          }}
          animate={{
            y: ['0vh', '110vh'],
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

// Rain Showers Effect - Moderate, balanced
const RainShowersEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      left: (i / 25) * 100 + Math.random() * 4 - 2,
      delay: Math.random() * 5,
      duration: 1.8 + Math.random() * 1.2,
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
            top: -20,
            width: 1.5,
            height: drop.height,
            opacity: drop.opacity,
          }}
          animate={{
            y: ['0vh', '110vh'],
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
  // Rain drops - moderate intensity
  const drops = useMemo(() => 
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: (i / 40) * 100 + Math.random() * 3 - 1.5,
      delay: Math.random() * 3,
      duration: 1.2 + Math.random() * 0.6,
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
    
    // Variable interval between lightning strikes (3-7 seconds)
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 4000;
      return setTimeout(() => {
        flash();
        scheduleNext();
      }, delay);
    };
    
    // Initial flash after short delay
    const initialTimeout = setTimeout(flash, 800);
    const intervalId = scheduleNext();
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(intervalId);
    };
  }, []);

  return (
    <>
      {/* Rain */}
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
            y: ['0vh', '110vh'],
          }}
          transition={{
            duration: drop.duration,
            delay: drop.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
      
      {/* Lightning flash - screen flash */}
      <motion.div
        className="absolute inset-0 bg-white pointer-events-none"
        animate={{
          opacity: lightningState.flash ? 0.3 : 0,
        }}
        transition={{
          duration: 0.05,
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
        <svg width="24" height="70" viewBox="0 0 40 120" fill="none">
          <path
            d="M20 0L5 50H18L8 120L35 45H20L30 0H20Z"
            fill="white"
            filter="drop-shadow(0 0 10px rgba(255,255,255,0.8))"
          />
        </svg>
      </motion.div>
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
