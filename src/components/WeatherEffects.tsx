import { memo, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
}

type EffectType = 'rain' | 'snow' | 'thunder' | null;

const WeatherEffects = memo(({ weatherCode, isLoading }: WeatherEffectsProps) => {
  // Determine effect type based on weather code
  // Removed: sun, clouds, fog animations (codes 0, 1-3, 45, 48)
  const effectType = useMemo((): EffectType => {
    if (!weatherCode || isLoading) return null;
    
    // Rain: 51-67, 80-82
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
      return 'rain';
    }
    // Snow: 71-77, 85-86
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
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
      {effectType === 'snow' && <SnowEffect />}
      {effectType === 'thunder' && <ThunderEffect />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// Rain Effect - Gentle and balanced with snow
const RainEffect = memo(() => {
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

RainEffect.displayName = 'RainEffect';

// Snow Effect - Gentle and slow (kept subtle as requested)
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

// Thunder Effect - Dramatic with random lightning positions
const ThunderEffect = memo(() => {
  // Rain drops - more intense than regular rain but still balanced
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

  // Multiple lightning bolts with random positions - regenerate on each flash
  const [lightningState, setLightningState] = useState({
    positions: [15, 45, 75],
    flash: false,
  });
  
  useEffect(() => {
    // Create dramatic lightning pattern with variable timing
    const flash = () => {
      // Random positions for this flash
      const newPositions = [
        5 + Math.random() * 90,
        5 + Math.random() * 90,
        5 + Math.random() * 90,
      ];
      
      // First flash
      setLightningState({ positions: newPositions, flash: true });
      
      // Quick off
      setTimeout(() => setLightningState(s => ({ ...s, flash: false })), 80);
      
      // Second flash (aftershock) - sometimes
      if (Math.random() > 0.3) {
        setTimeout(() => setLightningState(s => ({ ...s, flash: true })), 150);
        setTimeout(() => setLightningState(s => ({ ...s, flash: false })), 200);
      }
      
      // Third flash (rare double strike)
      if (Math.random() > 0.7) {
        setTimeout(() => setLightningState(s => ({ ...s, flash: true })), 300);
        setTimeout(() => setLightningState(s => ({ ...s, flash: false })), 350);
      }
    };
    
    // Variable interval between lightning strikes (2-6 seconds)
    const scheduleNext = () => {
      const delay = 2000 + Math.random() * 4000;
      return setTimeout(() => {
        flash();
        scheduleNext();
      }, delay);
    };
    
    // Initial flash after short delay
    const initialTimeout = setTimeout(flash, 500);
    const intervalId = scheduleNext();
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(intervalId);
    };
  }, []);

  return (
    <>
      {/* Heavy rain */}
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
          opacity: lightningState.flash ? 0.35 : 0,
        }}
        transition={{
          duration: 0.05,
        }}
      />
      
      {/* Multiple lightning bolts at random positions */}
      {lightningState.positions.map((position, index) => (
        <motion.div
          key={index}
          className="absolute top-0"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
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
      ))}
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
