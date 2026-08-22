import { useEffect, useRef } from 'react';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { MEDIA_URL_TTL } from '@/lib/mediaPresets';

interface RowWithMedia {
  profile_image_url?: string | null;
  video_url?: string | null;
}

/**
 * Förvärmer EXAKT de mediefiler som kandidatdialogen renderar för samtliga
 * rader som just nu ligger i listan (normalt 25 per sida).
 *
 * Varför: dialogen visar porträttet UTAN transform (originalkvalitet) och
 * signed-URL-cachen nycklas på (path + typ + transform). Listans avatarer
 * warmar bara 40px-varianten, så utan den här hooken måste varje kandidatbyte
 * signera och ladda porträttet på nytt — det är den kvarvarande "blixten".
 *
 * Regler:
 *  - Ren cache-logik, noll UI-bieffekter
 *  - Max 4 samtidiga hämtningar så synliga avatarer aldrig köas bort
 *  - Hoppas helt över på sparläge/2G
 */
// Skyddsräcken vid stora volymer: listan kan innehålla hundratals rader efter
// upprepad "fortsätt ladda". Utan tak skulle vi signera och ladda ner varje
// video i hela listan — ren bortkastad bandbredd.
const MAX_NEW_ROWS_PER_RUN = 30;
const MAX_WARMED_IMAGES = 200;
const MAX_WARMED_VIDEOS = 60;

export function useCandidateRowMediaWarmup(rows: RowWithMedia[] | undefined, enabled = true) {
  const warmedRef = useRef<Set<string>>(new Set());
  const imageCountRef = useRef(0);
  const videoCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !rows || rows.length === 0) return;

    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;
    const slowish = conn?.effectiveType === '3g';

    const warmed = warmedRef.current;
    const tasks: Array<() => Promise<unknown>> = [];
    let newRows = 0;

    for (const row of rows) {
      if (newRows >= MAX_NEW_ROWS_PER_RUN) break;
      let touched = false;

      const img = row?.profile_image_url?.trim();
      if (img && !warmed.has(`full:${img}`) && imageCountRef.current < MAX_WARMED_IMAGES) {
        warmed.add(`full:${img}`);
        imageCountRef.current += 1;
        touched = true;
        tasks.push(() => prefetchMediaUrl(img, 'profile-image', MEDIA_URL_TTL).catch(() => {}));
      }

      const vid = row?.video_url?.trim();
      if (vid && !warmed.has(`vid:${vid}`) && !slowish && videoCountRef.current < MAX_WARMED_VIDEOS) {
        warmed.add(`vid:${vid}`);
        videoCountRef.current += 1;
        touched = true;
        tasks.push(() => prefetchMediaUrl(vid, 'profile-video').catch(() => {}));
      }

      if (touched) newRows += 1;
    }


    if (tasks.length === 0) return;

    let cancelled = false;
    let index = 0;
    const CONCURRENCY = 4;

    const runNext = (): Promise<void> => {
      if (cancelled || index >= tasks.length) return Promise.resolve();
      const task = tasks[index++];
      return task().then(runNext, runNext);
    };

    const start = () => {
      for (let i = 0; i < CONCURRENCY; i++) void runNext();
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const ric = (globalThis as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
      idleId = ric(start, { timeout: 600 });
    } else {
      timeoutId = window.setTimeout(start, 200);
    }

    return () => {
      cancelled = true;
      const w = globalThis as unknown as { cancelIdleCallback?: (id: number) => void };
      if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [rows, enabled]);
}
