import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';
import { appendVersionToUrl } from '@/lib/versionedMediaUrl';

/**
 * Centraliserad bild-loading för kort.
 *
 * VARFÖR: Tidigare hade varje JobCard 4 useState + 2 useEffect + 4 useMemo
 * BARA för bildhantering. Med 20 kort per sida = 200+ hook-anrop per
 * tab-byte → React reconciler-jobb dominerade huvudtråden.
 *
 * Den här hooken konsoliderar allt till 2 useState + 1 useEffect + 2 useMemo,
 * och delar samma upplösningslogik mellan både huvudbild och logo.
 *
 * 🚀 SKALBARHET: Stöd för Supabase Image Transformations (WebP + resize).
 * Originalbilder är ofta 2-5 MB → transformerade <100 KB. Vid 10 000 användare
 * per dag sparar detta flera TB bandbredd och gör listvyer 5-10× snabbare.
 */
export interface CardImageTransform {
  /** CSS pixels — renderas automatiskt i 2× för retina */
  width?: number;
  height?: number;
  /** 1-100, default 75 för listvyer (god balans kvalitet/storlek) */
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * 🔑 EXAKT samma URL som `useCardImage` renderar — inklusive retina-2×,
 * quality, resize och `?v=`-versionen.
 *
 * Förvärmning (prewarm) MÅSTE gå via den här funktionen. Warmar man
 * originalbildens URL istället får man en cache-MISS när kortet renderar
 * transform-URL:en — dubbel bandbredd och noll nytta.
 */
export function buildCardImageUrl(
  rawPath: string | null | undefined,
  bucket: 'job-images' | 'company-logos' | 'profile-images',
  version?: string | null,
  transform?: CardImageTransform,
): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;
  let path = rawPath.trim();
  if (!path) return null;
  if (path.startsWith('http')) {
    try {
      const parsed = new URL(path);
      const match = parsed.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/[^/]+\/(.+)$/);
      if (match?.[1]) path = decodeURIComponent(match[1]);
      else return path;
    } catch {
      return path;
    }
  }

  const transformPayload = transform
    ? {
        ...(transform.width ? { width: Math.round(transform.width * 2) } : {}),
        ...(transform.height ? { height: Math.round(transform.height * 2) } : {}),
        quality: transform.quality ?? 75,
        resize: transform.resize ?? ('cover' as const),
      }
    : undefined;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path, transformPayload ? { transform: transformPayload } : undefined);
  return appendVersionToUrl(data?.publicUrl || null, version);
}



export function useCardImage(
  rawPath: string | null | undefined,
  bucket: 'job-images' | 'company-logos' | 'profile-images',
  version?: string | null | undefined,
  transform?: CardImageTransform,
) {
  const normalizedRawPath = useMemo(() => {
    if (!rawPath || typeof rawPath !== 'string') return null;
    const trimmed = rawPath.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('http')) return trimmed;
    try {
      const parsed = new URL(trimmed);
      const match = parsed.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/[^/]+\/(.+)$/);
      return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
    } catch {
      return trimmed;
    }
  }, [rawPath]);

  // Stabil signatur för transform — undviker onödig URL-rebuild
  const transformSig = transform
    ? `${transform.width ?? ''}x${transform.height ?? ''}q${transform.quality ?? 75}r${transform.resize ?? 'cover'}`
    : '';

  // Steg 1: Lös ut publik URL (rent useMemo, ingen render-kostnad efter mount)
  const resolvedUrl = useMemo(() => {
    if (!normalizedRawPath) return null;
    if (normalizedRawPath.startsWith('http')) return normalizedRawPath;

    // Bygg transform-payload (retina-aware: 2× för crisp rendering på Apple/Android-skärmar)
    const transformPayload = transform
      ? {
          ...(transform.width ? { width: Math.round(transform.width * 2) } : {}),
          ...(transform.height ? { height: Math.round(transform.height * 2) } : {}),
          quality: transform.quality ?? 75,
          resize: transform.resize ?? ('cover' as const),
        }
      : undefined;

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(normalizedRawPath, transformPayload ? { transform: transformPayload } : undefined);
    return appendVersionToUrl(data?.publicUrl || null, version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRawPath, bucket, version, transformSig]);

  // Steg 2: Synkron cache-läsning (ingen blink, ingen useEffect)
  const cachedBlobUrl = useMemo(
    () => (resolvedUrl ? imageCache.getCachedUrl(resolvedUrl) : null),
    [resolvedUrl]
  );

  // Bild-CDN:en kan neka transformering (t.ex. mycket stora original) → fall
  // tillbaka på originalbilden så att kortet aldrig blir tomt.
  const [transformFailed, setTransformFailed] = useState(false);

  useEffect(() => {
    setTransformFailed(false);
  }, [normalizedRawPath]);

  const originalUrl = useMemo(() => {
    if (!normalizedRawPath || normalizedRawPath.startsWith('http')) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedRawPath);
    return appendVersionToUrl(data?.publicUrl || null, version);
  }, [normalizedRawPath, bucket, version]);

  // Steg 3: Fyll blob-cachen i bakgrunden OM bilden inte redan finns där.
  // Vi byter ALDRIG src på en bild som redan ritats (raw → blob tvingar en
  // omladdning som syns som ett ryck) — blobben plockas upp synkront
  // (cachedBlobUrl) vid nästa montering istället.
  useEffect(() => {
    if (!resolvedUrl || cachedBlobUrl) return;
    let cancelled = false;
    imageCache
      .loadImage(resolvedUrl)
      .catch(() => {
        // Transformeringen nekades → visa originalbilden istället.
        if (!cancelled && originalUrl && resolvedUrl !== originalUrl) setTransformFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUrl, cachedBlobUrl]);

  // Föredra blob-cache (snabbast, offline-vänligt), men fall ALLTID tillbaka
  // till raw resolvedUrl så att bilden garanterat ritas även om blob-laddningen
  // ännu inte hunnit klart eller service-worker/CDN gör att fetchen fastnar.
  // (Tidigare returnerades null tills blob var klar → risk för permanent
  // placeholder om blob-fetchen aldrig avslutades.)
  const displayUrl = transformFailed && originalUrl
    ? originalUrl
    : (cachedBlobUrl || resolvedUrl);

  // 🚀 Proaktiv decode: så fort vi har en URL, dekoda bitmapen off-main-thread.
  // Eliminerar "decode-blinken" när ett kort re-mountas efter scroll — bilden
  // finns redan i browserns decode-cache och första frame renderas klar.
  // Osynlig ändring: ingen UI-effekt, ingen fade, inget extra nätverksanrop.
  useEffect(() => {
    if (!displayUrl) return;
    const img = new Image();
    img.src = displayUrl;
    img.decode?.().catch(() => { /* src kan bytas ut → ignorera */ });
  }, [displayUrl]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (e.currentTarget.src.startsWith('blob:')) {
        if (resolvedUrl) imageCache.evict(resolvedUrl);
        return;
      }
      // Transformerad URL kunde inte renderas → visa originalbilden istället
      if (originalUrl && e.currentTarget.src !== originalUrl) {
        setTransformFailed(true);
      }
    },
    [resolvedUrl, originalUrl]
  );

  return { displayUrl, handleError };
}
