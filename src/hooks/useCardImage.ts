import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';

/**
 * Centraliserad bild-loading för kort.
 *
 * VARFÖR: Tidigare hade varje JobCard 4 useState + 2 useEffect + 4 useMemo
 * BARA för bildhantering. Med 20 kort per sida = 200+ hook-anrop per
 * tab-byte → React reconciler-jobb dominerade huvudtråden.
 *
 * Den här hooken konsoliderar allt till 2 useState + 1 useEffect + 2 useMemo,
 * och delar samma upplösningslogik mellan både huvudbild och logo.
 */
export function useCardImage(
  rawPath: string | null | undefined,
  bucket: 'job-images' | 'company-logos' | 'profile-images'
) {
  // Steg 1: Lös ut publik URL (rent useMemo, ingen render-kostnad efter mount)
  const resolvedUrl = useMemo(() => {
    if (!rawPath) return null;
    if (rawPath.startsWith('http')) return rawPath;
    const { data } = supabase.storage.from(bucket).getPublicUrl(rawPath);
    return data?.publicUrl || null;
  }, [rawPath, bucket]);

  // Steg 2: Synkron cache-läsning (ingen blink, ingen useEffect)
  const cachedBlobUrl = useMemo(
    () => (resolvedUrl ? imageCache.getCachedUrl(resolvedUrl) : null),
    [resolvedUrl]
  );

  const [loadedBlobUrl, setLoadedBlobUrl] = useState<string | null>(null);
  const [blobFailed, setBlobFailed] = useState(false);

  // Steg 3: Async ladda till blob-cache OM inte redan i cache.
  // Notera: setState körs bara när bilden faktiskt levereras → ingen extra
  // re-render under tab-switch om cachen är varm.
  useEffect(() => {
    if (!resolvedUrl || cachedBlobUrl) {
      if (loadedBlobUrl !== null) setLoadedBlobUrl(null);
      return;
    }
    setBlobFailed(false);
    let cancelled = false;
    imageCache
      .loadImage(resolvedUrl)
      .then((blobUrl) => {
        if (!cancelled) setLoadedBlobUrl(blobUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // loadedBlobUrl avsiktligt utelämnad: vi vill inte rerenda kedjan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUrl, cachedBlobUrl]);

  // Fallback-priority: blob → loaded → original URL (visa alltid något direkt)
  const displayUrl = blobFailed
    ? resolvedUrl
    : cachedBlobUrl || loadedBlobUrl || resolvedUrl;

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (e.currentTarget.src.startsWith('blob:')) {
        if (resolvedUrl) imageCache.evict(resolvedUrl);
        setBlobFailed(true);
      }
    },
    [resolvedUrl]
  );

  return { displayUrl, handleError };
}
