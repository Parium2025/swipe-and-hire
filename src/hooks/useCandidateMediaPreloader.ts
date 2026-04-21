import { useEffect, useRef } from 'react';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import type { ApplicationData } from '@/hooks/useApplicationsData';

/**
 * Premium media preloader for the CandidateSwipeViewer.
 *
 * Mirrors the strategy used by useSwipeImagePreloader for jobs, but adapted
 * for PRIVATE buckets (profile-image / profile-video) which require signed URLs.
 *
 * - One-time bulk preload of the first `initialBulk` candidates when the viewer opens
 * - Rolling window: `lookahead` ahead + `lookbehind` behind around currentIndex
 * - Preloads BOTH profile image and profile video (poster frame warms blob-cache)
 * - Batched (6 at a time) and scheduled via requestIdleCallback so we never
 *   saturate the network or block the UI thread
 *
 * Pure cache logic — no UI side effects, no prop changes on CandidateSlide.
 */
export function useCandidateMediaPreloader(
  applications: ApplicationData[] | undefined,
  currentIndex: number,
  enabled: boolean,
  lookahead = 10,
  lookbehind = 2,
  initialBulk = 25,
) {
  const loadedRef = useRef(new Set<string>());
  const didBulkRef = useRef(false);

  // Reset bulk flag when the viewer closes so re-opening re-bulks if needed
  useEffect(() => {
    if (!enabled) {
      didBulkRef.current = false;
    }
  }, [enabled]);

  // One-time bulk preload of the first N candidates as soon as the viewer opens.
  useEffect(() => {
    if (!enabled) return;
    if (didBulkRef.current) return;
    if (!applications || applications.length === 0) return;
    didBulkRef.current = true;

    type Task = { path: string; type: 'profile-image' | 'profile-video' };
    const tasks: Task[] = [];
    const upper = Math.min(initialBulk, applications.length);

    for (let i = 0; i < upper; i++) {
      const app = applications[i];
      if (app?.profile_image_url && !loadedRef.current.has(`img:${app.profile_image_url}`)) {
        loadedRef.current.add(`img:${app.profile_image_url}`);
        tasks.push({ path: app.profile_image_url, type: 'profile-image' });
      }
      if (app?.video_url && !loadedRef.current.has(`vid:${app.video_url}`)) {
        loadedRef.current.add(`vid:${app.video_url}`);
        tasks.push({ path: app.video_url, type: 'profile-video' });
      }
    }

    if (tasks.length === 0) return;

    const run = () => {
      const batchSize = 6;
      let i = 0;
      const next = () => {
        if (i >= tasks.length) return;
        const batch = tasks.slice(i, i + batchSize);
        i += batchSize;
        Promise.allSettled(
          batch.map(t => prefetchMediaUrl(t.path, t.type).catch(() => {})),
        ).finally(next);
      };
      next();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 50);
    }
  }, [enabled, applications, initialBulk]);

  // Rolling window preload around the current index.
  useEffect(() => {
    if (!enabled) return;
    if (!applications || applications.length === 0) return;

    const start = Math.max(0, currentIndex - lookbehind);
    const end = Math.min(currentIndex + lookahead, applications.length - 1);

    type Task = { path: string; type: 'profile-image' | 'profile-video' };
    const tasks: Task[] = [];

    for (let i = start; i <= end; i++) {
      if (i === currentIndex) continue; // current is already loading via useMediaUrl
      const app = applications[i];
      if (app?.profile_image_url && !loadedRef.current.has(`img:${app.profile_image_url}`)) {
        loadedRef.current.add(`img:${app.profile_image_url}`);
        tasks.push({ path: app.profile_image_url, type: 'profile-image' });
      }
      if (app?.video_url && !loadedRef.current.has(`vid:${app.video_url}`)) {
        loadedRef.current.add(`vid:${app.video_url}`);
        tasks.push({ path: app.video_url, type: 'profile-video' });
      }
    }

    if (tasks.length === 0) return;

    // Fire and forget — prefetchMediaUrl handles dedupe internally too.
    tasks.forEach(t => {
      prefetchMediaUrl(t.path, t.type).catch(() => {});
    });
  }, [enabled, applications, currentIndex, lookahead, lookbehind]);
}
