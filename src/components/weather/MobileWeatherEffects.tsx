/**
 * Mobile Weather Effects — Pure CSS animations (zero framer-motion).
 *
 * All particle animations run on the GPU compositor thread via CSS @keyframes,
 * keeping the JS main thread completely free for touch scrolling.
 *
 * The only JS remaining is a single setTimeout for the shooting-star timer
 * (one state update every 40-80 s — negligible).
 */
import { memo, useMemo, useState, useEffect } from 'react';
import { getOrCreateStars } from './weatherUtils';

/* ─── Stars ─── */
export const MobileStarsEffect = memo(() => {
  const stars = useMemo(() => getOrCreateStars(true), []);

  const [shootingStar, setShootingStar] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    size: number;
    key: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const trigger = () => {
      if (cancelled) return;
      setShootingStar({
        active: true,
        startX: 5 + Math.random() * 40,
        startY: 3 + Math.random() * 25,
        size: 1 + Math.random() * 1.5,
        key: Date.now(),
      });
      // Clear after animation completes
      setTimeout(() => { if (!cancelled) setShootingStar(null); }, 5000);
    };

    const scheduleNext = () => {
      const delay = 40000 + Math.random() * 40000;
      timeout = setTimeout(() => {
        trigger();
        scheduleNext();
      }, delay);
    };

    timeout = setTimeout(() => {
      trigger();
      scheduleNext();
    }, 10000 + Math.random() * 10000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            willChange: 'opacity',
            // Custom properties drive the keyframe values
            '--star-max': star.opacity,
            '--star-min': star.opacity * 0.4,
            animation: `weather-twinkle ${star.twinkleDuration}s ${star.twinkleDelay}s ease-in-out infinite`,
          } as React.CSSProperties}
        />
      ))}

      {shootingStar?.active && (
        <div
          key={shootingStar.key}
          className="absolute bg-white rounded-full"
          style={{
            right: `${shootingStar.startX}%`,
            top: `${shootingStar.startY}%`,
            width: shootingStar.size,
            height: shootingStar.size,
            boxShadow: '0 0 2px 0.5px rgba(255,255,255,0.5)',
            animation: 'weather-shooting-star 5s linear forwards',
          }}
        />
      )}
    </>
  );
});
MobileStarsEffect.displayName = 'MobileStarsEffect';

/* ─── Cloudy ─── */
export const MobileCloudyEffect = memo(() => {
  const clouds = useMemo(
    () =>
      Array.from({ length: 2 }).map((_, i) => ({
        id: i,
        top: 5 + i * 18 + Math.random() * 10,
        size: 80 + Math.random() * 60,
        opacity: 0.06 + Math.random() * 0.04,
        duration: 60 + Math.random() * 40,
        delay: -(Math.random() * 60), // negative delay = start mid-animation
      })),
    [],
  );

  return (
    <>
      {clouds.map((cloud) => (
        <div
          key={cloud.id}
          className="absolute bg-white rounded-full"
          style={{
            top: `${cloud.top}%`,
            width: cloud.size,
            height: cloud.size * 0.5,
            opacity: cloud.opacity,
            filter: 'blur(16px)',
            animation: `weather-cloud ${cloud.duration}s ${cloud.delay}s linear infinite`,
          }}
        />
      ))}
    </>
  );
});
MobileCloudyEffect.displayName = 'MobileCloudyEffect';

/* ─── Rain ─── */
export const MobileRainEffect = memo(() => {
  const drops = useMemo(
    () =>
      Array.from({ length: 15 }).map((_, i) => {
        const duration = 1.2 + Math.random() * 0.6;
        const staggerDelay = (i / 15) * duration + Math.random() * 0.3;
        return {
          id: i,
          left: (i / 15) * 120 - 10,
          duration,
          delay: staggerDelay,
          height: 16 + Math.random() * 14,
          opacity: 0.35 + Math.random() * 0.25,
        };
      }),
    [],
  );

  return (
    <>
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute rounded-full"
          style={{
            left: `${drop.left}%`,
            width: 2,
            height: drop.height,
            opacity: drop.opacity,
            backgroundColor: 'hsl(210 80% 70% / 0.5)',
            animation: `weather-rain ${drop.duration}s ${drop.delay}s linear infinite`,
          }}
        />
      ))}
    </>
  );
});
MobileRainEffect.displayName = 'MobileRainEffect';

/* ─── Snow ─── */
export const MobileSnowEffect = memo(() => {
  const flakes = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => {
        const duration = 12 + Math.random() * 6;
        const staggerDelay = (i / 18) * duration * 0.8 + Math.random() * 2;
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
    [],
  );

  return (
    <>
      {flakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${flake.left}%`,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            filter: 'blur(0.5px)',
            '--sway': `${flake.swayAmount}px`,
            animation: `weather-snow ${flake.duration}s ${flake.delay}s linear infinite`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
});
MobileSnowEffect.displayName = 'MobileSnowEffect';

/* ─── Thunder ─── */
export const MobileThunderEffect = memo(() => {
  const drops = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: (i / 18) * 130 - 15,
        delay: Math.random() * 3,
        duration: 1.0 + Math.random() * 0.5,
        height: 15 + Math.random() * 12,
        opacity: 0.35 + Math.random() * 0.25,
      })),
    [],
  );

  const [lightningState, setLightningState] = useState({
    position: 50,
    flash: false,
  });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const flash = () => {
      if (cancelled) return;
      setLightningState({ position: 10 + Math.random() * 80, flash: true });
      setTimeout(() => {
        if (!cancelled) setLightningState((s) => ({ ...s, flash: false }));
      }, 100);
    };

    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 5000;
      timeout = setTimeout(() => {
        flash();
        scheduleNext();
      }, delay);
    };

    timeout = setTimeout(() => {
      flash();
      scheduleNext();
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute rounded-full"
          style={{
            left: `${drop.left}%`,
            top: -40,
            width: 2,
            height: drop.height,
            opacity: drop.opacity,
            backgroundColor: 'hsl(210 60% 80% / 0.6)',
            animation: `weather-rain ${drop.duration}s ${drop.delay}s linear infinite`,
          }}
        />
      ))}

      {/* Lightning flash overlay */}
      <div
        className="absolute inset-0 bg-white/50 pointer-events-none"
        style={{
          opacity: lightningState.flash ? 0.08 : 0,
          transition: 'opacity 0.08s',
        }}
      />

      {/* Lightning bolt */}
      <div
        className="absolute top-0"
        style={{
          left: `${lightningState.position}%`,
          transform: 'translateX(-50%)',
          opacity: lightningState.flash ? 1 : 0,
          transition: 'opacity 0.05s',
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
MobileThunderEffect.displayName = 'MobileThunderEffect';
