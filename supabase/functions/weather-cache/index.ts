import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

// ─── Types ───────────────────────────────────────────────────────

interface WeatherEntry {
  data: unknown;
  timestamp: number;
}

interface CityEntry {
  city: string;
  timestamp: number;
}

// ─── In-memory caches ─────────────────────────────────────────────
//
// These are per-instance caches. Edge functions are stateless, so a cache hit
// only helps when the same instance is reused. Still, it removes a huge amount
// of redundant Open-Meteo/Nominatim traffic for popular coordinates.

class LRUCache<K, V> {
  private map = new Map<K, V>();

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(key, value);
  }

  size(): number {
    return this.map.size;
  }
}

const weatherCache = new LRUCache<string, WeatherEntry>(5000);
const cityCache = new LRUCache<string, CityEntry>(5000);
const ipCache = new LRUCache<string, { data: { lat: number; lon: number; city: string }; timestamp: number }>(20000);

// ─── TTLs ─────────────────────────────────────────────────────────

const WEATHER_TTL = 15 * 60 * 1000; // 15 minutes
const WEATHER_FALLBACK_TTL = 60 * 1000; // 1 min — never poison the grid with a neutral 0°
const CITY_TTL = 60 * 60 * 1000; // 1 hour (cities don't move)
const CITY_EMPTY_TTL = 5 * 60 * 1000; // retry unknown city sooner
const IP_TTL = 6 * 60 * 60 * 1000; // 6h — an IP's city rarely changes
const OPEN_METEO_TIMEOUT_MS = 4500;
// The client aborts at 5s; leave room so a slow geocode never costs the weather.
const CITY_LOOKUP_BUDGET_MS = 2000;

// Nominatim's usage policy requires an identifying User-Agent; without it
// requests are rate limited/403:ed at volume.
const GEO_HEADERS = { 'User-Agent': 'Parium/1.0 (https://parium.se)' };

// ─── Rate limiting (per-instance, token bucket) ──────────────────
//
// The weather endpoint is public (verify_jwt = false) so it can be called before
// login. We still want to stop obvious abuse / proxy-style scraping. This is
// a best-effort per-instance limit; it resets when the function cold-starts.

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIP(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

// ─── Validation schemas ──────────────────────────────────────────

const WeatherBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const IpLookupBodySchema = z.object({
  ipLookup: z.literal(true),
});

const RequestBodySchema = z.union([WeatherBodySchema, IpLookupBodySchema]);

// ─── Helpers ───────────────────────────────────────────────────────

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

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

function errorResponse(message: string, status: number, extraHeaders?: Record<string, string>) {
  return jsonResponse({ error: message }, status, extraHeaders);
}

async function fetchWeather(lat: number, lon: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=sunrise,sunset&timezone=auto`,
    { signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS) },
  );
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return await res.json();
}

async function fetchCity(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`,
      { signal: AbortSignal.timeout(2500), headers: GEO_HEADERS },
    );
    if (res.ok) {
      const data = await res.json();
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.municipality ||
        data.address?.village ||
        data.address?.suburb ||
        data.address?.county ||
        '';
      return city.replace(/\s+kommun$/i, '').trim();
    }
  } catch {
    /* Nominatim failed */
  }

  // Fallback: BigDataCloud
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      return (data.city || data.locality || data.principalSubdivision || '').replace(/\s+kommun$/i, '').trim();
    }
  } catch {
    /* Both failed */
  }

  return '';
}

async function ipLookup(req: Request) {
  const ip = getClientIP(req);

  if (ip && ip !== 'unknown') {
    const hit = ipCache.get(ip);
    if (hit && Date.now() - hit.timestamp < IP_TTL) {
      return jsonResponse(hit.data, 200, { 'Cache-Control': 'no-store' });
    }
  }

  let result: { lat: number; lon: number; city: string } | null = null;

  // Try ipapi.co first (city-level accuracy, generous free tier)
  try {
    const url = ip && ip !== 'unknown' ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const d = await res.json();
      if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        result = {
          lat: d.latitude,
          lon: d.longitude,
          city: (d.city || '').replace(/\s+kommun$/i, '').trim(),
        };
      }
    }
  } catch {
    /* try next */
  }

  // Fallback: ipwho.is
  if (!result) {
    try {
      const url = ip && ip !== 'unknown' ? `https://ipwho.is/${ip}` : 'https://ipwho.is/';
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const d = await res.json();
        if (d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          result = {
            lat: d.latitude,
            lon: d.longitude,
            city: (d.city || '').replace(/\s+kommun$/i, '').trim(),
          };
        }
      }
    } catch {
      /* give up */
    }
  }

  if (!result) {
    return errorResponse('ip-lookup-failed', 404, { 'Cache-Control': 'no-store' });
  }

  if (ip && ip !== 'unknown') {
    ipCache.set(ip, { data: result, timestamp: Date.now() });
  }

  return jsonResponse(result, 200, { 'Cache-Control': 'no-store' });
}

async function weatherLookup(lat: number, lon: number) {
  const key = cacheKey(lat, lon);
  const now = Date.now();
  const startedAt = now;

  // Check weather cache
  let weatherData: unknown;
  const cached = weatherCache.get(key);
  if (cached && now - cached.timestamp < WEATHER_TTL) {
    weatherData = cached.data;
  } else {
    let isFallback = false;
    try {
      weatherData = await fetchWeather(roundCoord(lat), roundCoord(lon));
    } catch (weatherError) {
      console.warn('Open-Meteo unavailable, returning safe fallback:', weatherError);
      weatherData = fallbackWeather(roundCoord(lat), roundCoord(lon));
      isFallback = true;
    }
    // A fallback response must expire quickly so a short upstream outage
    // doesn't lock an entire coordinate grid to a neutral 0° for 15 minutes.
    weatherCache.set(key, {
      data: weatherData,
      timestamp: isFallback ? now - (WEATHER_TTL - WEATHER_FALLBACK_TTL) : now,
    });
  }

  // Check city cache
  let city: string;
  const cachedCity = cityCache.get(key);
  const cityTtl = cachedCity?.city ? CITY_TTL : CITY_EMPTY_TTL;
  if (cachedCity && now - cachedCity.timestamp < cityTtl) {
    city = cachedCity.city;
  } else if (Date.now() - startedAt > CITY_LOOKUP_BUDGET_MS) {
    // Weather already ate the request budget; return without the city rather
    // than letting the client time out and lose the temperature as well.
    city = cachedCity?.city ?? '';
  } else {
    city = await fetchCity(roundCoord(lat), roundCoord(lon));
    cityCache.set(key, { city, timestamp: now });
  }

  return jsonResponse({ weather: weatherData, city }, 200, { 'Cache-Control': 'no-store' });
}

// ─── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ip = getClientIP(req);
  if (isRateLimited(ip)) {
    return errorResponse('rate-limit-exceeded', 429, { 'Retry-After': '60' });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('invalid json body', 400);
    }

    const parsed = RequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse('valid lat/lon or ipLookup required', 400);
    }

    if ('ipLookup' in parsed.data) {
      return await ipLookup(req);
    }

    const { lat, lon } = parsed.data;
    return await weatherLookup(lat, lon);
  } catch (err) {
    console.error('Weather cache error:', err);
    return errorResponse('Internal error', 500);
  }
});
