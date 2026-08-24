const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory cache: key = rounded coords, value = { data, timestamp }
const weatherCache = new Map<string, { data: unknown; timestamp: number }>();
const cityCache = new Map<string, { city: string; timestamp: number }>();

const WEATHER_TTL = 15 * 60 * 1000; // 15 minutes
const WEATHER_FALLBACK_TTL = 60 * 1000; // 1 min — never poison the grid with a neutral 0°
const CITY_TTL = 60 * 60 * 1000;    // 1 hour (cities don't move)
const CITY_EMPTY_TTL = 5 * 60 * 1000; // retry unknown city sooner
const MAX_CACHE_ENTRIES = 10000;
const OPEN_METEO_TIMEOUT_MS = 4500;
// Nominatim's usage policy requires an identifying User-Agent; without it
// requests are rate limited/403:ed at volume.
const GEO_HEADERS = { 'User-Agent': 'Parium/1.0 (https://parium.se)' };

const fallbackWeather = (lat: number, lon: number) => ({
  latitude: lat,
  longitude: lon,
  current: {
    time: new Date().toISOString().slice(0, 16),
    temperature_2m: 0,
    apparent_temperature: 0,
    weather_code: 0,
  },
  daily: {
    time: [new Date().toISOString().slice(0, 10)],
    sunrise: [`${new Date().toISOString().slice(0, 10)}T07:00`],
    sunset: [`${new Date().toISOString().slice(0, 10)}T17:00`],
  },
  fallback: true,
});

/** Round coordinates to ~1km grid for cache deduplication */
function roundCoord(val: number): number {
  return Math.round(val * 100) / 100; // ~1.1km precision
}

function cacheKey(lat: number, lon: number): string {
  return `${roundCoord(lat)},${roundCoord(lon)}`;
}

async function fetchWeather(lat: number, lon: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=sunrise,sunset&timezone=auto`,
    { signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return await res.json();
}

async function fetchCity(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.municipality ||
                   data.address?.village || data.address?.suburb || data.address?.county || '';
      return city.replace(/\s+kommun$/i, '').trim();
    }
  } catch { /* Nominatim failed */ }

  // Fallback: BigDataCloud
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      return (data.city || data.locality || data.principalSubdivision || '').replace(/\s+kommun$/i, '').trim();
    }
  } catch { /* Both failed */ }

  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Server-side IP geolocation (fallback for browsers behind iCloud Private Relay)
    if (body?.ipLookup === true) {
      const ip =
        req.headers.get('cf-connecting-ip') ||
        req.headers.get('x-real-ip') ||
        (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();

      let result: { lat: number; lon: number; city: string } | null = null;

      // Try ipapi.co first (city-level accuracy, generous free tier)
      try {
        const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const d = await res.json();
          if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
            result = { lat: d.latitude, lon: d.longitude, city: (d.city || '').replace(/\s+kommun$/i, '').trim() };
          }
        }
      } catch { /* try next */ }

      // Fallback: ipwho.is
      if (!result) {
        try {
          const url = ip ? `https://ipwho.is/${ip}` : 'https://ipwho.is/';
          const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const d = await res.json();
            if (d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
              result = { lat: d.latitude, lon: d.longitude, city: (d.city || '').replace(/\s+kommun$/i, '').trim() };
            }
          }
        } catch { /* give up */ }
      }

      if (!result) {
        return new Response(JSON.stringify({ error: 'ip-lookup-failed' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lat, lon } = body;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return new Response(JSON.stringify({ error: 'lat and lon required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = cacheKey(lat, lon);
    const now = Date.now();

    // Check weather cache
    let weatherData: unknown;
    const cached = weatherCache.get(key);
    if (cached && now - cached.timestamp < WEATHER_TTL) {
      weatherData = cached.data;
    } else {
      try {
        weatherData = await fetchWeather(roundCoord(lat), roundCoord(lon));
      } catch (weatherError) {
        console.warn('Open-Meteo unavailable, returning safe fallback:', weatherError);
        weatherData = fallbackWeather(roundCoord(lat), roundCoord(lon));
      }
      weatherCache.set(key, { data: weatherData, timestamp: now });
    }

    // Check city cache
    let city: string;
    const cachedCity = cityCache.get(key);
    if (cachedCity && now - cachedCity.timestamp < CITY_TTL) {
      city = cachedCity.city;
    } else {
      city = await fetchCity(lat, lon);
      cityCache.set(key, { city, timestamp: now });
    }

    // Cleanup old entries periodically (keep cache bounded)
    if (weatherCache.size > 10000) {
      const cutoff = now - WEATHER_TTL;
      for (const [k, v] of weatherCache) {
        if (v.timestamp < cutoff) weatherCache.delete(k);
      }
    }

    return new Response(JSON.stringify({ weather: weatherData, city }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Weather cache error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
