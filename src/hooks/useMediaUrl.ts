import { useEffect, useState } from 'react';
import { getMediaUrl, type MediaType } from '@/lib/mediaManager';

export function useMediaUrl(storagePath: string | null | undefined, mediaType: MediaType, expiresInSeconds: number = 86400) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function resolve() {
      if (!storagePath) {
        if (isMounted) setUrl(null);
        return;
      }
      try {
        const u = await getMediaUrl(storagePath, mediaType, expiresInSeconds);
        if (isMounted) setUrl(u);
      } catch (e) {
        if (isMounted) setUrl(null);
      }
    }
    resolve();
    return () => { isMounted = false; };
  }, [storagePath, mediaType, expiresInSeconds]);

  return url;
}
