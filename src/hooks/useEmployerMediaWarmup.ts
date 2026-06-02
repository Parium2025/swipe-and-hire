import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { supabase } from '@/integrations/supabase/client';
import { imageCache } from '@/lib/imageCache';

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

interface ConversationLike {
  id?: string;
  members?: Array<{
    user_id?: string;
    profile?: {
      profile_image_url?: string | null;
      company_logo_url?: string | null;
    } | null;
  }>;
  applicationSnapshot?: {
    profile_image_snapshot_url?: string | null;
  } | null;
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

    // 🖼️ JOB AD IMAGES — speglar jobbsökarens warmup-mönster.
    // Warmar `job_image_url` + `company_logo_url` direkt in i `imageCache`
    // SÅ FORT ['jobs', ...] dyker upp i cachen (via background-sync eller
    // sidebar-prefetch). Resultat: när användaren öppnar /dashboard eller
    // /my-jobs är ALLA annonsbilder redan inlästa → ingen blixt vid navigering.
    const JOB_IMAGES_MAX = 80;

    const warmJobAdImages = (jobs: unknown) => {
      if (!Array.isArray(jobs)) return;
      const urls: string[] = [];
      let scanned = 0;
      for (const job of jobs) {
        if (!job || typeof job !== 'object') continue;
        const j = job as { job_image_url?: string | null; company_logo_url?: string | null };

        if (j.job_image_url && typeof j.job_image_url === 'string') {
          const path = j.job_image_url.trim();
          if (path && !warmed.has(`job-img:${path}`)) {
            warmed.add(`job-img:${path}`);
            const { data } = supabase.storage.from('job-images').getPublicUrl(path);
            if (data?.publicUrl) urls.push(data.publicUrl);
          }
        }
        if (j.company_logo_url && typeof j.company_logo_url === 'string') {
          const path = j.company_logo_url.trim();
          if (path && !warmed.has(`co-logo:${path}`)) {
            warmed.add(`co-logo:${path}`);
            const { data } = supabase.storage.from('company-logos').getPublicUrl(path);
            if (data?.publicUrl) urls.push(data.publicUrl);
          }
        }
        if (++scanned >= JOB_IMAGES_MAX) break;
      }
      if (urls.length === 0) return;
      queueMicrotask(() => {
        imageCache.preloadImages(urls).catch(() => {});
      });
    };

    // Initial scan av jobs-cachen (alla matchande nycklar oavsett scope/orgId)
    const allJobsQueries = queryClient.getQueryCache().findAll({ queryKey: ['jobs'] });
    for (const q of allJobsQueries) {
      warmJobAdImages(q.state.data);
    }

    // 💬 CONVERSATION AVATARS — speglar jobbsökarens warmup-mönster
    // (useJobSeekerMediaWarmup). Warmar motpartens profil-/logobild +
    // application-snapshot bilder i ['conversations', userId], så att
    // /messages visas utan "popping in" första gången.
    const warmConversations = (items: ConversationLike[] | undefined) => {
      if (!Array.isArray(items)) return;
      const avatars: string[] = [];
      const logos: string[] = [];
      for (const conv of items) {
        if (!conv) continue;

        const snap = conv.applicationSnapshot?.profile_image_snapshot_url;
        if (typeof snap === 'string' && snap.trim() !== '' && !warmed.has(`conv-av:${snap}`)) {
          warmed.add(`conv-av:${snap}`);
          avatars.push(snap);
        }

        for (const m of conv.members ?? []) {
          if (!m || m.user_id === userId) continue;
          const img = m.profile?.profile_image_url;
          const logo = m.profile?.company_logo_url;
          if (typeof img === 'string' && img.trim() !== '' && !warmed.has(`conv-av:${img}`)) {
            warmed.add(`conv-av:${img}`);
            avatars.push(img);
          }
          if (typeof logo === 'string' && logo.trim() !== '' && !warmed.has(`conv-logo:${logo}`)) {
            warmed.add(`conv-logo:${logo}`);
            logos.push(logo);
          }
        }
        if (avatars.length + logos.length >= MAX_NEW_PER_UPDATE) break;
      }

      if (avatars.length === 0 && logos.length === 0) return;
      queueMicrotask(() => {
        if (avatars.length > 0) {
          Promise.allSettled(
            avatars.map((p) =>
              prefetchMediaUrl(p, 'profile-image', 86400, AVATAR_TRANSFORM).catch(() => {}),
            ),
          );
        }
        if (logos.length > 0) {
          const LOGO_TRANSFORM = { width: 80, height: 80, resize: 'cover' as const };
          Promise.allSettled(
            logos.map((p) =>
              prefetchMediaUrl(p, 'company-logo', 86400, LOGO_TRANSFORM).catch(() => {}),
            ),
          );
        }
      });
    };

    // Initial scan av conversations-cachen
    const conversationsData = queryClient.getQueryData<ConversationLike[]>(['conversations', userId]);
    warmConversations(conversationsData);

    // Lyssna på framtida uppdateringar (när progressive pagination eller
    // background sync lägger till nya sidor)
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const key = event.query.queryKey;
      if (!Array.isArray(key)) return;
      const head = key[0];

      // Job ad images: ['jobs', scope, orgId, userId]
      if (head === 'jobs') {
        warmJobAdImages(event.query.state.data);
        return;
      }

      // Conversation avatars: ['conversations', userId]
      if (head === 'conversations' && key[1] === userId) {
        warmConversations(event.query.state.data as ConversationLike[] | undefined);
        return;
      }

      // Kandidat-/ansökningsmedia (befintligt flöde)
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
