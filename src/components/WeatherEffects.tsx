import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
}

type EffectType = 'rain' | 'snow' | 'sun' | 'clouds' | 'fog' | 'thunder' | null;

const WeatherEffects = memo(({ weatherCode, isLoading }: WeatherEffectsProps) => {
  // Determine effect type based on weather code
  const effectType = useMemo((): EffectType => {
    if (!weatherCode || isLoading) return null;
    
    // Clear/Sunny: 0
    if (weatherCode === 0) {
      return 'sun';
    }
    // Partly cloudy: 1-3
    if (weatherCode >= 1 && weatherCode <= 3) {
      return 'clouds';
    }
    // Fog: 45, 48
    if (weatherCode === 45 || weatherCode === 48) {
      return 'fog';
    }
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
      {effectType === 'sun' && <SunEffect />}
      {effectType === 'clouds' && <CloudsEffect />}
      {effectType === 'fog' && <FogEffect />}
      {effectType === 'thunder' && <ThunderEffect />}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

// Rain Effect - Subtle and slow
const RainEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      left: (i / 25) * 100 + Math.random() * 4 - 2,
      delay: Math.random() * 5,
      duration: 2.5 + Math.random() * 1.5,
      height: 8 + Math.random() * 8,
      opacity: 0.15 + Math.random() * 0.15,
    })),
  []);

  return (
    <>
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-300/30 rounded-full"
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

// Sun Effect - Soft and subtle glow
const SunEffect = memo(() => {
  const rays = useMemo(() => 
    Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      rotation: (i * 45),
      delay: i * 0.3,
    })),
  []);

  return (
    <div className="absolute -top-40 -right-40 w-96 h-96">
      {/* Sun glow - very subtle */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-radial from-yellow-200/15 via-orange-200/8 to-transparent"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.4, 0.5, 0.4],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Sun core - softer */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-100/25 to-orange-200/15"
        animate={{
          scale: [1, 1.03, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Rays - fewer and more subtle */}
      {rays.map((ray) => (
        <motion.div
          key={ray.id}
          className="absolute top-1/2 left-1/2 w-0.5 h-28 origin-bottom"
          style={{
            rotate: `${ray.rotation}deg`,
            translateX: '-50%',
            translateY: '-100%',
          }}
          initial={{ opacity: 0.1, scaleY: 0.9 }}
          animate={{
            opacity: [0.1, 0.25, 0.1],
            scaleY: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 5,
            delay: ray.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className="w-full h-full bg-gradient-to-t from-yellow-200/20 to-transparent rounded-full" />
        </motion.div>
      ))}
    </div>
  );
});

SunEffect.displayName = 'SunEffect';

// Clouds Effect - Slow drifting clouds
const CloudsEffect = memo(() => {
  const clouds = useMemo(() => [
    { id: 1, top: '5%', size: 140, duration: 80, delay: 0, opacity: 0.08 },
    { id: 2, top: '12%', size: 100, duration: 65, delay: 10, opacity: 0.06 },
    { id: 3, top: '8%', size: 180, duration: 95, delay: 25, opacity: 0.05 },
  ], []);

  return (
    <>
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute"
          style={{
            top: cloud.top,
            width: cloud.size,
            height: cloud.size * 0.5,
          }}
          initial={{ x: '-30%' }}
          animate={{
            x: ['calc(-30%)', 'calc(100vw + 30%)'],
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <div 
            className="w-full h-full bg-white rounded-full blur-2xl"
            style={{ opacity: cloud.opacity }}
          />
        </motion.div>
      ))}
    </>
  );
});

CloudsEffect.displayName = 'CloudsEffect';

// Fog Effect - Very subtle moving layers
const FogEffect = memo(() => {
  const fogLayers = useMemo(() => [
    { id: 1, y: '35%', duration: 40, opacity: 0.06, blur: 60 },
    { id: 2, y: '55%', duration: 50, opacity: 0.05, blur: 70 },
  ], []);

  return (
    <>
      {fogLayers.map((layer) => (
        <motion.div
          key={layer.id}
          className="absolute inset-x-0 h-72"
          style={{
            top: layer.y,
            background: `linear-gradient(90deg, transparent, rgba(200, 200, 200, ${layer.opacity}), transparent)`,
            filter: `blur(${layer.blur}px)`,
          }}
          animate={{
            x: ['-30%', '30%', '-30%'],
          }}
          transition={{
            duration: layer.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
});

FogEffect.displayName = 'FogEffect';

// Thunder Effect - Subtle lightning with gentle rain
const ThunderEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: (i / 30) * 100 + Math.random() * 3 - 1.5,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 1,
      height: 10 + Math.random() * 10,
      opacity: 0.2 + Math.random() * 0.15,
    })),
  []);

  return (
    <>
      {/* Gentle rain */}
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-200/30 rounded-full"
          style={{
            left: `${drop.left}%`,
            top: -30,
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
      
      {/* Subtle lightning flash - less frequent */}
      <motion.div
        className="absolute inset-0 bg-white/5"
        animate={{
          opacity: [0, 0, 0, 0, 0, 0, 0.15, 0, 0.08, 0, 0, 0, 0, 0, 0, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.1, 0.2, 0.3, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        }}
      />
      
      {/* Subtle lightning bolt */}
      <motion.div
        className="absolute top-0 left-1/3"
        animate={{
          opacity: [0, 0, 0, 0, 0, 0, 0.6, 0, 0.3, 0, 0, 0, 0, 0, 0, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.1, 0.2, 0.3, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        }}
      >
        <svg width="30" height="90" viewBox="0 0 40 120" fill="none">
          <path
            d="M20 0L5 50H18L8 120L35 45H20L30 0H20Z"
            fill="url(#lightning-gradient)"
          />
          <defs>
            <linearGradient id="lightning-gradient" x1="20" y1="0" x2="20" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity="0.6" />
              <stop offset="1" stopColor="#60A5FA" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
