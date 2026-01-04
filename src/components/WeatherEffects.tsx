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

// Rain Effect
const RainEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: (i / 50) * 100 + Math.random() * 2 - 1,
      delay: Math.random() * 2,
      duration: 0.6 + Math.random() * 0.4,
      height: 15 + Math.random() * 15,
      opacity: 0.3 + Math.random() * 0.4,
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

// Snow Effect
const SnowEffect = memo(() => {
  const flakes = useMemo(() => 
    Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: (i / 35) * 100 + Math.random() * 3 - 1.5,
      delay: Math.random() * 4,
      duration: 5 + Math.random() * 4,
      size: 4 + Math.random() * 5,
      opacity: 0.5 + Math.random() * 0.4,
      swayAmount: 20 + Math.random() * 30,
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
            top: -20,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: 'blur(0.5px)',
          }}
          animate={{
            y: ['0vh', '105vh'],
            x: [0, flake.swayAmount, 0, -flake.swayAmount, 0],
            rotate: [0, 360],
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

SnowEffect.displayName = 'SnowEffect';

// Sun Effect - Animated sun rays
const SunEffect = memo(() => {
  const rays = useMemo(() => 
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      rotation: (i * 30),
      delay: i * 0.1,
    })),
  []);

  return (
    <div className="absolute -top-32 -right-32 w-80 h-80">
      {/* Sun glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-radial from-yellow-300/30 via-orange-300/15 to-transparent"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.6, 0.8, 0.6],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Sun core */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-200/40 to-orange-300/30"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Rays */}
      {rays.map((ray) => (
        <motion.div
          key={ray.id}
          className="absolute top-1/2 left-1/2 w-1 h-32 origin-bottom"
          style={{
            rotate: `${ray.rotation}deg`,
            translateX: '-50%',
            translateY: '-100%',
          }}
          initial={{ opacity: 0.2, scaleY: 0.8 }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scaleY: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 2,
            delay: ray.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className="w-full h-full bg-gradient-to-t from-yellow-300/40 to-transparent rounded-full" />
        </motion.div>
      ))}
    </div>
  );
});

SunEffect.displayName = 'SunEffect';

// Clouds Effect - Floating clouds
const CloudsEffect = memo(() => {
  const clouds = useMemo(() => [
    { id: 1, top: '5%', size: 120, duration: 35, delay: 0, opacity: 0.15 },
    { id: 2, top: '12%', size: 90, duration: 28, delay: 5, opacity: 0.12 },
    { id: 3, top: '8%', size: 150, duration: 40, delay: 12, opacity: 0.1 },
    { id: 4, top: '18%', size: 80, duration: 32, delay: 8, opacity: 0.14 },
    { id: 5, top: '3%', size: 100, duration: 38, delay: 20, opacity: 0.11 },
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
          initial={{ x: '-20%' }}
          animate={{
            x: ['calc(-20%)', 'calc(100vw + 20%)'],
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <div 
            className="w-full h-full bg-white rounded-full blur-xl"
            style={{ opacity: cloud.opacity }}
          />
        </motion.div>
      ))}
    </>
  );
});

CloudsEffect.displayName = 'CloudsEffect';

// Fog Effect - Layered moving fog
const FogEffect = memo(() => {
  const fogLayers = useMemo(() => [
    { id: 1, y: '30%', duration: 20, opacity: 0.15, blur: 40 },
    { id: 2, y: '50%', duration: 25, opacity: 0.12, blur: 50 },
    { id: 3, y: '70%', duration: 18, opacity: 0.18, blur: 35 },
  ], []);

  return (
    <>
      {fogLayers.map((layer) => (
        <motion.div
          key={layer.id}
          className="absolute inset-x-0 h-64"
          style={{
            top: layer.y,
            background: `linear-gradient(90deg, transparent, rgba(200, 200, 200, ${layer.opacity}), transparent)`,
            filter: `blur(${layer.blur}px)`,
          }}
          animate={{
            x: ['-50%', '50%', '-50%'],
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

// Thunder Effect - Lightning flashes with rain
const ThunderEffect = memo(() => {
  const drops = useMemo(() => 
    Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: (i / 60) * 100 + Math.random() * 2 - 1,
      delay: Math.random() * 1.5,
      duration: 0.5 + Math.random() * 0.3,
      height: 20 + Math.random() * 20,
      opacity: 0.4 + Math.random() * 0.3,
    })),
  []);

  return (
    <>
      {/* Heavy rain */}
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-200/50 rounded-full"
          style={{
            left: `${drop.left}%`,
            top: -40,
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
      
      {/* Lightning flash */}
      <motion.div
        className="absolute inset-0 bg-white/10"
        animate={{
          opacity: [0, 0, 0, 0.3, 0, 0.15, 0, 0, 0, 0, 0, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.2, 0.21, 0.22, 0.24, 0.25, 0.27, 0.5, 0.7, 0.8, 0.9, 1],
        }}
      />
      
      {/* Lightning bolt */}
      <motion.div
        className="absolute top-0 left-1/3"
        animate={{
          opacity: [0, 0, 0, 1, 0, 0.6, 0, 0, 0, 0, 0, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
          times: [0, 0.2, 0.21, 0.22, 0.24, 0.25, 0.27, 0.5, 0.7, 0.8, 0.9, 1],
        }}
      >
        <svg width="40" height="120" viewBox="0 0 40 120" fill="none">
          <path
            d="M20 0L5 50H18L8 120L35 45H20L30 0H20Z"
            fill="url(#lightning-gradient)"
          />
          <defs>
            <linearGradient id="lightning-gradient" x1="20" y1="0" x2="20" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity="0.9" />
              <stop offset="1" stopColor="#60A5FA" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </>
  );
});

ThunderEffect.displayName = 'ThunderEffect';

export default WeatherEffects;
