import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface WeatherEffectsProps {
  weatherCode: number | null;
  isLoading: boolean;
}

const WeatherEffects = memo(({ weatherCode, isLoading }: WeatherEffectsProps) => {
  // Determine effect type based on weather code
  const effectType = useMemo(() => {
    if (!weatherCode || isLoading) return null;
    
    // Rain: 51-67, 80-82
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
      return 'rain';
    }
    // Snow: 71-77, 85-86
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
      return 'snow';
    }
    return null;
  }, [weatherCode, isLoading]);

  if (!effectType) return null;

  const particleCount = effectType === 'rain' ? 40 : 30;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: particleCount }).map((_, i) => (
        <Particle key={i} type={effectType} index={i} total={particleCount} />
      ))}
    </div>
  );
});

WeatherEffects.displayName = 'WeatherEffects';

interface ParticleProps {
  type: 'rain' | 'snow';
  index: number;
  total: number;
}

const Particle = memo(({ type, index, total }: ParticleProps) => {
  const startX = useMemo(() => (index / total) * 100 + Math.random() * 5 - 2.5, [index, total]);
  const delay = useMemo(() => Math.random() * 3, []);
  const duration = useMemo(() => (type === 'rain' ? 0.8 + Math.random() * 0.4 : 4 + Math.random() * 3), [type]);
  const size = useMemo(() => (type === 'rain' ? 1 : 4 + Math.random() * 4), [type]);
  const opacity = useMemo(() => (type === 'rain' ? 0.4 + Math.random() * 0.3 : 0.5 + Math.random() * 0.4), [type]);

  if (type === 'rain') {
    return (
      <motion.div
        className="absolute bg-primary/20 rounded-full"
        style={{
          left: `${startX}%`,
          top: -20,
          width: size,
          height: 15 + Math.random() * 10,
          opacity,
        }}
        animate={{
          y: ['0vh', '105vh'],
        }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    );
  }

  // Snow
  return (
    <motion.div
      className="absolute bg-foreground/20 rounded-full"
      style={{
        left: `${startX}%`,
        top: -20,
        width: size,
        height: size,
        opacity,
        filter: 'blur(0.5px)',
      }}
      animate={{
        y: ['0vh', '105vh'],
        x: [0, Math.sin(index) * 30, 0],
        rotate: [0, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
        x: {
          duration: duration * 0.5,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        },
      }}
    />
  );
});

Particle.displayName = 'Particle';

export default WeatherEffects;
