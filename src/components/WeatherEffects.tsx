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

// Rain Effect - Strong and visible
const RainEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: (i / 80) * 100 + Math.random() * 2 - 1,
      delay: Math.random() * 3,
      duration: 0.8 + Math.random() * 0.4,
      height: 15 + Math.random() * 20,
      opacity: 0.4 + Math.random() * 0.3,
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
  // Heavy rain drops - larger and more visible
  const drops = useMemo(() => 
    Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      left: (i / 100) * 100 + Math.random() * 2 - 1,
      delay: Math.random() * 2,
      duration: 0.6 + Math.random() * 0.3,
      height: 20 + Math.random() * 25,
      width: 2.5 + Math.random() * 1.5,
      opacity: 0.5 + Math.random() * 0.3,
    })),
  []);

  // Multiple lightning bolts with random positions
  const [lightningPositions, setLightningPositions] = useState<number[]>([25, 50, 75]);
  
  useEffect(() => {
    const updatePositions = () => {
      setLightningPositions([
        10 + Math.random() * 80,
        10 + Math.random() * 80,
        10 + Math.random() * 80,
      ]);
    };
    
    // Change lightning positions every flash cycle
    const interval = setInterval(updatePositions, 5000);
    return () => clearInterval(interval);
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
      
      {/* Lightning flash - more intense */}
      <motion.div
        className="absolute inset-0 bg-white/15"
        animate={{
          opacity: [0, 0, 0, 0.25, 0, 0.15, 0, 0, 0, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.3, 0.35, 0.36, 0.38, 0.4, 0.42, 0.5, 0.8, 1],
        }}
      />
      
      {/* Multiple lightning bolts at random positions - smaller size */}
      {lightningPositions.map((position, index) => (
        <motion.div
          key={index}
          className="absolute top-0"
          style={{ left: `${position}%` }}
          animate={{
            opacity: [0, 0, 0, 0.8, 0, 0.5, 0, 0, 0, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.3, 0.35, 0.36, 0.38, 0.4, 0.42, 0.5, 0.8, 1],
            delay: index * 0.05,
          }}
        >
          <svg width="20" height="60" viewBox="0 0 40 120" fill="none">
            <path
              d="M20 0L5 50H18L8 120L35 45H20L30 0H20Z"
              fill="url(#lightning-gradient)"
            />
            <defs>
              <linearGradient id="lightning-gradient" x1="20" y1="0" x2="20" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="white" stopOpacity="0.9" />
                <stop offset="1" stopColor="#60A5FA" stopOpacity="0.4" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      ))}
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
