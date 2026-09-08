import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'message-attachments';
const SIGN_SECONDS = 60 * 60 * 24 * 365; // 1 år
/** Förnya i god tid innan länken dör så inga gamla bilagor blir trasiga. */
const RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

/** Plockar ut lagringssökvägen ur en signerad Supabase-URL. */
export function extractAttachmentPath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes('://') && !url.startsWith('/')) return url;
  const match = url.match(new RegExp(`/object/(?:sign|public)/${BUCKET}/([^?]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Läser exp ur tokenet i en signerad URL (ms sedan epoch), null om okänt. */
function readExpiry(url: string): number | null {
  try {
    const token = new URL(url, window.location.origin).searchParams.get('token');
    if (!token) return null;
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

const cache = new Map<string, string>();

/**
 * Returnerar en giltig länk till en bilaga. Är den sparade länken på väg att gå ut
 * (eller redan död) skapas en färsk signerad länk från samma lagringssökväg.
 */
/**
 * Förladdar bildbilagor så att de redan ligger i webbläsarens cache när
 * bubblan renderas – inga sena inhopp när man scrollar i en konversation.
 */
export function prefetchAttachmentImages(
  attachments: Array<{ url: string | null | undefined; type: string | null | undefined }>
) {
  if (typeof window === 'undefined') return;
  for (const a of attachments) {
    if (!a.url || !a.type?.startsWith('image/')) continue;
    const path = extractAttachmentPath(a.url);
    const src = path ? cache.get(path) : a.url;
    if (!src) continue;
    if (prefetched.has(src)) continue;
    prefetched.add(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}

const prefetched = new Set<string>();

export function useAttachmentUrl(storedUrl: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    // Läs cachen redan i render → aldrig en tom ruta först.
    const path = extractAttachmentPath(storedUrl);
    if (!path) return storedUrl || null;
    return cache.get(path) || (storedUrl?.includes('://') ? storedUrl : null);
  });

  useEffect(() => {
    if (!storedUrl) {
      setUrl(null);
      return;
    }

    const path = extractAttachmentPath(storedUrl);
    if (!path) {
      setUrl(storedUrl);
      return;
    }

    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }

    const expiry = readExpiry(storedUrl);
    const isStoragePath = !storedUrl.includes('://') && !storedUrl.startsWith('/');
    const needsRenewal = isStoragePath || expiry === null || expiry - Date.now() < RENEW_BEFORE_MS;
    if (!needsRenewal) {
      setUrl(storedUrl);
      return;
    }

    let cancelled = false;
    setUrl(isStoragePath ? null : storedUrl);
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGN_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  return url;
}
