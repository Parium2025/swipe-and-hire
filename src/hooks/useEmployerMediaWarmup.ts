import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';

/**
 * 🖼️ EMPLOYER MEDIA WARMUP
 *
 * Förvärmer profilbilder för kandidater och my_candidates SÅ FORT
 * datan dyker upp i React Query-cachen — inte bara för sida 1 (som
 * useCandidateBackgroundSync redan gör), utan även för sida 2/3/...
 * som kommer in via useProgressivePagination.
 *
 * Resultat: när användaren navigerar till /candidates eller /my-candidates
 * så finns ALLA profilbilder redan i blob-cachen → ingen "popping in".
 *
 * Strategi:
 *  - Lyssnar på React Query cache-events (kostar nästan inget)
 *  - Avduplicerar via en global Set så samma bild aldrig prefetchas två gånger
 *  - Begränsar till 50 nya bilder per cache-update så vi aldrig DDoS:ar oss själva
 *  - Kör i microtask så vi aldrig blockerar render
 *
 * Säkerhet:
 *  - Ren cache-hook, INGA UI-bieffekter
 *  - Tysta fails (catch noop)
 *  - Avregistrerar vid unmount
 */

const AVATAR_TRANSFORM = { width: 40, height: 40, resize: 'cover' as const };
const PROFILE_IMAGE_TRANSFORM = { width: 200, height: 200, resize: 'cover' as const };
const MAX_NEW_PER_UPDATE = 50;

interface ItemWithMedia {
  applicant_id?: string;
  profile_image_url?: string | null;
  video_url?: string | null;
  is_profile_video?: boolean | null;
}

interface InfinitePageData {
  pages: Array<{ items?: ItemWithMedia[] }>;
}

export function useEmployerMediaWarmup() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const warmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    if (userRole?.role !== 'employer') return;

    const userId = user.id;
    const warmed = warmedRef.current;

    const collectAndWarm = (data: InfinitePageData | undefined) => {
      if (!data?.pages) return;

      const imagePaths: string[] = [];
      const videoPaths: string[] = [];

      for (const page of data.pages) {
        if (!page?.items) continue;
        for (const item of page.items) {
          const img = item?.profile_image_url;
          if (typeof img === 'string' && img.trim() !== '' && !warmed.has(`img:${img}`)) {
            warmed.add(`img:${img}`);
            imagePaths.push(img);
          }
          const vid = item?.video_url;
          if (typeof vid === 'string' && vid.trim() !== '' && !warmed.has(`vid:${vid}`)) {
            warmed.add(`vid:${vid}`);
            videoPaths.push(vid);
          }
        }
      }

      if (imagePaths.length === 0 && videoPaths.length === 0) return;

      // Begränsa per update för att skydda mot megalistor
      const limitedImages = imagePaths.slice(0, MAX_NEW_PER_UPDATE);
      const limitedVideos = videoPaths.slice(0, Math.min(10, videoPaths.length));

      // Microtask så vi aldrig blockerar render
      queueMicrotask(() => {
        // Avatar-storlek (för listor)
        Promise.allSettled(
          limitedImages.map((p) =>
            prefetchMediaUrl(p, 'profile-image', 86400, AVATAR_TRANSFORM).catch(() => {}),
          ),
        );
        // Större (för detaljvy / swipe) — cap till 10 för att spara bandbredd
        Promise.allSettled(
          limitedImages.slice(0, 10).map((p) =>
            prefetchMediaUrl(p, 'profile-image', 86400, PROFILE_IMAGE_TRANSFORM).catch(() => {}),
          ),
        );
        // Videos (poster frame)
        Promise.allSettled(
          limitedVideos.map((p) => prefetchMediaUrl(p, 'profile-video').catch(() => {})),
        );
      });
    };

    // Initial scan av befintlig data
    const applicationsData = queryClient.getQueryData<InfinitePageData>(['applications', userId, '']);
    const myCandidatesData = queryClient.getQueryData<InfinitePageData>(['my-candidates', userId, '']);
    collectAndWarm(applicationsData);
    collectAndWarm(myCandidatesData);

    // Lyssna på framtida uppdateringar (när progressive pagination eller
    // background sync lägger till nya sidor)
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const key = event.query.queryKey;
      if (!Array.isArray(key)) return;
      const head = key[0];
      const owner = key[1];
      if (owner !== userId) return;
      if (head !== 'applications' && head !== 'my-candidates') return;

      const data = event.query.state.data as InfinitePageData | undefined;
      collectAndWarm(data);
    });

    return () => {
      unsubscribe();
    };
  }, [user, userRole?.role, queryClient]);
}
