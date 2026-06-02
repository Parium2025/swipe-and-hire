import { supabase } from '@/integrations/supabase/client';
import { COMPANY_LOGO_TRANSFORM } from '@/lib/imageTransforms';

// Memoization-cache. Nyckeln innehåller hela raw-URL:n (inkl. ?t=/?v=)
// så att en ny image_updated_at-version automatiskt blir en ny nyckel.
// LRU-trimning vid ~200 entries för att inte läcka minne över tid.
const resolveCache = new Map<string, string | null>();
const CACHE_LIMIT = 200;

function setCache(key: string, value: string | null): string | null {
  if (resolveCache.size >= CACHE_LIMIT) {
    const firstKey = resolveCache.keys().next().value;
    if (firstKey !== undefined) resolveCache.delete(firstKey);
  }
  resolveCache.set(key, value);
  return value;
}

function compute(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const version = parsed.searchParams.get('t') || parsed.searchParams.get('v') || undefined;
    const match = parsed.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/public\/company-logos\/(.+)$/);

    if (match?.[1]) {
      const path = decodeURIComponent(match[1]);
      const { data } = supabase.storage
        .from('company-logos')
        .getPublicUrl(path, { transform: COMPANY_LOGO_TRANSFORM });

      if (!data?.publicUrl) return trimmed;
      if (!version) return data.publicUrl;

      const transformed = new URL(data.publicUrl);
      transformed.searchParams.set('v', version);
      return transformed.toString();
    }
  } catch {
    // Fall through to storage-path handling below.
  }

  if (trimmed.startsWith('http')) return trimmed;

  const { data } = supabase.storage
    .from('company-logos')
    .getPublicUrl(trimmed, { transform: COMPANY_LOGO_TRANSFORM });
  return data?.publicUrl || trimmed;
}

export function resolveCompanyLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cached = resolveCache.get(rawUrl);
  if (cached !== undefined) return cached;
  return setCache(rawUrl, compute(rawUrl));
}

/** Töm cachen manuellt (t.ex. efter loggout eller bucket-rensning). */
export function clearCompanyLogoUrlCache(): void {
  resolveCache.clear();
}