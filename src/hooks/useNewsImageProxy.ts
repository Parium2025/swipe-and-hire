import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Hämtar nyhetsbilden via backend-funktionen, men som Blob-URL.
 * Anledning: <img> kan inte skicka headers (apikey/Authorization) om funktionen kräver verifiering.
 */
export function useNewsImageProxy(articleId: string, enabled: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const requestUrl = useMemo(() => {
    if (!articleId) return null;
    const base = import.meta.env.VITE_SUPABASE_URL;
    return `${base}/functions/v1/news-image-proxy?id=${encodeURIComponent(articleId)}`;
  }, [articleId]);

  useEffect(() => {
    // Cleanup any previous object URL
    const revoke = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    if (!enabled || !requestUrl) {
      revoke();
      setImageUrl(null);
      return;
    }

    const controller = new AbortController();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    (async () => {
      try {
        const res = await fetch(requestUrl, {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`news-image-proxy failed: ${res.status}`);

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.toLowerCase().startsWith("image/")) {
          throw new Error(`Unexpected content-type: ${contentType}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        revoke();
        objectUrlRef.current = url;
        setImageUrl(url);
      } catch (e) {
        if (controller.signal.aborted) return;
        revoke();
        setImageUrl(null);
      }
    })();

    return () => {
      controller.abort();
      revoke();
    };
  }, [enabled, requestUrl]);

  return { imageUrl };
}
