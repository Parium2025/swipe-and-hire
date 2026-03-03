// ─── Types ───────────────────────────────────────────────

export interface CachedLocation {
  lat: number;
  lon: number;
  city: string;
  timestamp: number;
  source: 'gps' | 'ip' | 'fallback';
}

export interface CachedWeather {
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  description: string;
  emoji: string;
  city: string;
  isNight: boolean;
  timestamp: number;
}

// ─── Cache keys & TTLs ──────────────────────────────────

const LOCATION_CACHE_KEY = 'parium_weather_location';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const LOCATION_CACHE_MAX_AGE = 3 * 60 * 1000; // 3 minutes
const WEATHER_CACHE_MAX_AGE = 5 * 60 * 1000;  // 5 minutes

// ─── Cache helpers ───────────────────────────────────────

export const getCachedLocation = (): CachedLocation | null => {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > LOCATION_CACHE_MAX_AGE) {
      console.log('Location cache expired, will refresh');
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const setCachedLocation = (location: Omit<CachedLocation, 'timestamp'>) => {
  try {
    const data: CachedLocation = { ...location, timestamp: Date.now() };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(data));
  } catch { /* Silent fail */ }
};

export const getCachedWeather = (): CachedWeather | null => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > WEATHER_CACHE_MAX_AGE) return null;
    return data;
  } catch {
    return null;
  }
};

export const setCachedWeather = (weather: Omit<CachedWeather, 'timestamp'>) => {
  try {
    const data: CachedWeather = { ...weather, timestamp: Date.now() };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
  } catch { /* Silent fail */ }
};

export const clearWeatherCache = () => {
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
    localStorage.removeItem(WEATHER_CACHE_KEY);
    console.log('Weather cache cleared');
  } catch { /* Silent fail */ }
};

// ─── Weather code → description / emoji ──────────────────

export const getWeatherInfo = (code: number, isNight: boolean): { description: string; emoji: string } => {
  if (code === 0) return { description: 'Klart', emoji: isNight ? '🌙' : '☀️' };
  if (code === 1) return { description: 'Mestadels klart', emoji: isNight ? '🌙' : '🌤️' };
  if (code === 2) return { description: 'Halvklart', emoji: isNight ? '🌙 ☁️' : '⛅' };
  if (code === 3) return { description: 'Molnigt', emoji: '☁️' };
  if (code === 45) return { description: 'Dimma', emoji: '🌁' };
  if (code === 48) return { description: 'Rimfrost', emoji: '🌁' };
  if (code === 51) return { description: 'Lätt duggregn', emoji: '🌧️' };
  if (code === 53) return { description: 'Duggregn', emoji: '🌧️' };
  if (code === 55) return { description: 'Kraftigt duggregn', emoji: '🌧️' };
  if (code === 56) return { description: 'Lätt underkylt regn', emoji: '🌧️' };
  if (code === 57) return { description: 'Underkylt regn', emoji: '🌧️' };
  if (code === 61) return { description: 'Lätt regn', emoji: '🌧️' };
  if (code === 63) return { description: 'Regn', emoji: '🌧️' };
  if (code === 65) return { description: 'Kraftigt regn', emoji: '🌧️' };
  if (code === 66) return { description: 'Lätt isregn', emoji: '🌧️' };
  if (code === 67) return { description: 'Isregn', emoji: '🌧️' };
  if (code === 71) return { description: 'Lätt snö', emoji: '❄️' };
  if (code === 73) return { description: 'Snö', emoji: '❄️' };
  if (code === 75) return { description: 'Kraftigt snöfall', emoji: '❄️' };
  if (code === 77) return { description: 'Snöhagel', emoji: '❄️' };
  if (code === 80) return { description: 'Lätta regnskurar', emoji: '🌦️' };
  if (code === 81) return { description: 'Regnskurar', emoji: '🌦️' };
  if (code === 82) return { description: 'Skyfall', emoji: '🌦️' };
  if (code === 85) return { description: 'Lätta snöbyar', emoji: '🌨️' };
  if (code === 86) return { description: 'Kraftiga snöbyar', emoji: '🌨️' };
  if (code === 95) return { description: 'Åska', emoji: '⛈️' };
  if (code === 96) return { description: 'Åska med hagel', emoji: '⛈️' };
  if (code === 99) return { description: 'Kraftig åska', emoji: '⛈️' };
  return { description: 'Okänt', emoji: '🌡️' };
};

// ─── Fetch current weather from Open-Meteo ──────────────

export const fetchCurrentWeather = async (lat: number, lon: number) => {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=sunrise,sunset&timezone=auto`
  );
  const data = await res.json();
  const current = data?.current;
  if (!current) throw new Error('Missing current weather data');
  
  const currentTimeStr = current.time;
  const todayStr = currentTimeStr?.split('T')[0];
  const dailyIndex = data.daily?.time?.indexOf(todayStr) ?? 0;
  const sunrise = data.daily?.sunrise?.[dailyIndex];
  const sunset = data.daily?.sunset?.[dailyIndex];
  
  let isNight = false;
  if (sunrise && sunset && currentTimeStr) {
    isNight = currentTimeStr < sunrise || currentTimeStr > sunset;
  }
  
  return {
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    weatherCode: current.weather_code as number,
    isNight,
  };
};

// ─── Geocoding ───────────────────────────────────────────

/** Clean up city name - remove "kommun" suffix */
const cleanCityName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s+kommun$/i, '').trim();
};

/** Reverse geocoding to get city name - with multiple fallback services */
export const getCityName = async (lat: number, lon: number): Promise<string> => {
  // Try Nominatim first
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.municipality ||
        data.address?.village ||
        data.address?.suburb ||
        data.address?.county ||
        '';
      if (city) return cleanCityName(city);
    }
  } catch { /* Try fallback */ }

  // Fallback: BigDataCloud
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      const data = await response.json();
      const city = data.city || data.locality || data.principalSubdivision || '';
      if (city) return cleanCityName(city);
    }
  } catch { /* Both services failed */ }

  return '';
};

/** IP-based geolocation (no permission required, less accurate) */
export const getLocationByIP = async (): Promise<{ lat: number; lon: number; city: string } | null> => {
  const services = [
    async () => {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.city || '' };
      }
      return null;
    },
    async () => {
      const response = await fetch('https://ipwho.is/');
      const data = await response.json();
      if (data.success && data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.city || '' };
      }
      return null;
    },
    async () => {
      const response = await fetch('https://freeipapi.com/api/json');
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude, city: data.cityName || '' };
      }
      return null;
    },
  ];

  for (const service of services) {
    try {
      const result = await service();
      if (result) return result;
    } catch { /* Try next service */ }
  }
  return null;
};

/** Forward geocode a city name to coordinates */
export const geocodeCity = async (city: string): Promise<{ lat: number; lon: number; name: string }> => {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=sv&format=json`
  );
  const data = await res.json();
  const best = data?.results?.[0];
  if (!best) throw new Error('No geocoding result');
  return {
    lat: best.latitude,
    lon: best.longitude,
    name: best.name ?? city,
  };
};

/** Fallback emoji based on time of day */
export function getTimeBasedEmoji(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '👋';
  return '🌙';
}

/** Movement threshold for IP fallback */
export const MOVEMENT_THRESHOLD_KM = 10;
