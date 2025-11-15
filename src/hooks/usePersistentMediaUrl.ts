import { useEffect, useState } from 'react';
import { getMediaUrl, type MediaType } from '@/lib/mediaManager';
import { getImmediateDataUrl, upsertDataUrl } from '@/lib/persistentImageCache';

/**
 * usePersistentMediaUrl
 * - Returnerar omedelbart en data-URL om den redan finns lagrad lokalt
 * - Hämtar samtidigt en färsk signed URL, laddar blob, uppdaterar local cache
 * - Returnerar sedan en objectURL (snabb) utan att blixtra
 */
export function usePersistentMediaUrl(
  storagePath: string | null | undefined,
  mediaType: MediaType,
  expiresInSeconds: number = 86400
) {
  // Ge omedelbart en eventuell tidigare sparad data-URL
  const [url, setUrl] = useState<string | null>(() => getImmediateDataUrl(storagePath));

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!storagePath) {
        if (alive) setUrl(null);
        return;
      }
      try {
        // 1) Hämta (cachad) signed URL via mediaManager
        const signed = await getMediaUrl(storagePath, mediaType, expiresInSeconds);
        if (!signed) return;

        // 2) Hämta blob och uppdatera persistent cache
        const resp = await fetch(signed, { cache: 'force-cache', credentials: 'include' });
        if (!resp.ok) return;
        const blob = await resp.blob();
        upsertDataUrl(storagePath, blob).catch(() => {});

        // 3) Skapa snabb objectURL för aktuell session
        const obj = URL.createObjectURL(blob);
        if (alive) setUrl(obj);
      } catch {
        // behåll ev. tidigare data-URL vid fel
      }
    }
    run();
    return () => { alive = false; };
  }, [storagePath, mediaType, expiresInSeconds]);

  return url;
}
