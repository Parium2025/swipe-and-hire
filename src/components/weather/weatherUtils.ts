// Shared weather effect utilities

const STARS_CACHE_KEY = 'parium_stars_config';
const STARS_MOBILE_CACHE_KEY = 'parium_stars_config_mobile';

export interface StarConfig {
  id: number;
  left: number;
  top: number;
  size: number;
  opacity: number;
  twinkleDelay: number;
  twinkleDuration: number;
}

export const getOrCreateStars = (isMobile: boolean): StarConfig[] => {
  const cacheKey = isMobile ? STARS_MOBILE_CACHE_KEY : STARS_CACHE_KEY;
  const count = isMobile ? 20 : 50;

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

export type EffectType = 'rain' | 'snow' | 'thunder' | 'cloudy' | null;

export function getEffectType(weatherCode: number | null, isLoading: boolean): EffectType {
  if (!weatherCode || isLoading) return null;
  if (weatherCode === 3) return 'cloudy';
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return 'rain';
  if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) return 'snow';
  if (weatherCode >= 95 && weatherCode <= 99) return 'thunder';
  return null;
}
