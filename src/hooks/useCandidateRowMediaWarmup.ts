import { useEffect, useMemo, useRef } from 'react';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { MEDIA_URL_TTL } from '@/lib/mediaPresets';

interface RowWithMedia {
  profile_image_url?: string | null;
  cover_image_url?: string | null;
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
  // Sidans data kan få en ny arrayreferens vid varje render. Starta inte om
  // kön (och avbryt dess återstående bilder) om bildvägarna inte ändrats.
  const mediaKey = useMemo(() => (rows || []).map((row) =>
    `${row.profile_image_url || ''}|${row.cover_image_url || ''}|${row.video_url || ''}`
  ).join('\n'), [rows]);

  useEffect(() => {
    if (!enabled || !rows || rows.length === 0) return;

    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;
    const slowish = conn?.effectiveType === '3g';

    const warmed = warmedRef.current;
    const tasks: Array<{ key: string; run: () => Promise<unknown>; video: boolean }> = [];
    let newRows = 0;

    for (const row of rows) {
      if (newRows >= MAX_NEW_ROWS_PER_RUN) break;
      let touched = false;

      const img = row?.profile_image_url?.trim();
      if (img && !warmed.has(`full:${img}`) && imageCountRef.current < MAX_WARMED_IMAGES) {
        warmed.add(`full:${img}`);
        imageCountRef.current += 1;
        touched = true;
        tasks.push({ key: `full:${img}`, video: false, run: () => prefetchMediaUrl(img, 'profile-image', MEDIA_URL_TTL).catch(() => {}) });
      }

      const cover = row?.cover_image_url?.trim();
      if (cover && !warmed.has(`full:${cover}`) && imageCountRef.current < MAX_WARMED_IMAGES) {
        warmed.add(`full:${cover}`);
        imageCountRef.current += 1;
        touched = true;
        tasks.push({ key: `full:${cover}`, video: false, run: () => prefetchMediaUrl(cover, 'profile-image', MEDIA_URL_TTL).catch(() => {}) });
      }

      const vid = row?.video_url?.trim();
      if (vid && !warmed.has(`vid:${vid}`) && !slowish && videoCountRef.current < MAX_WARMED_VIDEOS) {
        warmed.add(`vid:${vid}`);
        videoCountRef.current += 1;
        touched = true;
        tasks.push({ key: `vid:${vid}`, video: true, run: () => prefetchMediaUrl(vid, 'profile-video').catch(() => {}) });
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
      return task.run().then(runNext, runNext);
    };

    const start = () => {
      for (let i = 0; i < CONCURRENCY; i++) void runNext();
    };

    // Kandidatvyn kan öppnas direkt efter att listan visas. Idle/200 ms
    // gjorde att omslag och porträtt började hämtas först efter trycket.
    start();

    return () => {
      cancelled = true;
      // Nästa sidrender måste få värma bilder som ännu inte startats.
      for (const task of tasks.slice(index)) {
        warmed.delete(task.key);
        if (task.video) videoCountRef.current -= 1;
        else imageCountRef.current -= 1;
      }
    };
  // mediaKey är den faktiska bilddatan; rows-referensen ändras ofta utan nya filer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey, enabled]);
}
