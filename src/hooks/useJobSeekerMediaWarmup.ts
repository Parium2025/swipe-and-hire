import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';

/**
 * 🖼️ JOB SEEKER MEDIA WARMUP
 *
 * Speglar useEmployerMediaWarmup men för jobbsökarsidan. Förvärmer
 * tysta i bakgrunden:
 *  - Företagslogos i ['my-applications', userId]
 *  - Företagslogos i ['available-jobs'] / ['optimized-job-search', ...]
 *  - Avatars i ['conversations', userId] (motpartens profilbild)
 *
 * Resultat: när användaren öppnar /my-applications, /saved-jobs eller
 * /messages är ALLA logotyper/avatars redan i blob-cachen → ingen
 * "popping in".
 *
 * Säkerhet:
 *  - Ren cache-hook, INGA UI-bieffekter
 *  - Tysta fails (catch noop)
 *  - Avduplicerad via warmedRef + prefetchMediaUrl ongoingLoads-Map
 *  - Begränsar till MAX_NEW_PER_UPDATE per update för att skydda mot megalistor
 *  - Avregistrerar vid unmount
 */

const LOGO_TRANSFORM = { width: 80, height: 80, resize: 'cover' as const };
const AVATAR_TRANSFORM = { width: 40, height: 40, resize: 'cover' as const };
const MAX_NEW_PER_UPDATE = 50;

interface JobLike {
  id?: string;
  company_logo_url?: string | null;
  job_image_url?: string | null;
  job_postings?: {
    company_logo_url?: string | null;
    job_image_url?: string | null;
  } | null;
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

export function useJobSeekerMediaWarmup() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const warmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    if (userRole?.role !== 'job_seeker') return;

    const userId = user.id;
    const warmed = warmedRef.current;

    const warmLogos = (paths: string[]) => {
      if (paths.length === 0) return;
      queueMicrotask(() => {
        Promise.allSettled(
          paths.map((p) =>
            prefetchMediaUrl(p, 'company-logo', 86400, LOGO_TRANSFORM).catch(() => {}),
          ),
        );
      });
    };

    const warmAvatars = (paths: string[]) => {
      if (paths.length === 0) return;
      queueMicrotask(() => {
        Promise.allSettled(
          paths.map((p) =>
            prefetchMediaUrl(p, 'profile-image', 86400, AVATAR_TRANSFORM).catch(() => {}),
          ),
        );
      });
    };

    // Samla logo-paths från olika job-listor (applications / available-jobs / search)
    const collectFromJobsArray = (items: JobLike[] | undefined): string[] => {
      if (!Array.isArray(items)) return [];
      const out: string[] = [];
      for (const item of items) {
        if (!item) continue;
        const candidates = [
          item.company_logo_url,
          item.job_postings?.company_logo_url,
        ];
        for (const path of candidates) {
          if (typeof path === 'string' && path.trim() !== '' && !warmed.has(`logo:${path}`)) {
            warmed.add(`logo:${path}`);
            out.push(path);
            if (out.length >= MAX_NEW_PER_UPDATE) return out;
          }
        }
      }
      return out;
    };

    // Samla avatars från konversationer (motpartens bild)
    const collectFromConversations = (items: ConversationLike[] | undefined): { avatars: string[]; logos: string[] } => {
      const avatars: string[] = [];
      const logos: string[] = [];
      if (!Array.isArray(items)) return { avatars, logos };
      for (const conv of items) {
        if (!conv) continue;
        const snap = conv.applicationSnapshot?.profile_image_snapshot_url;
        if (typeof snap === 'string' && snap.trim() !== '' && !warmed.has(`av:${snap}`)) {
          warmed.add(`av:${snap}`);
          avatars.push(snap);
        }
        for (const m of conv.members ?? []) {
          if (!m || m.user_id === userId) continue;
          const img = m.profile?.profile_image_url;
          const logo = m.profile?.company_logo_url;
          if (typeof img === 'string' && img.trim() !== '' && !warmed.has(`av:${img}`)) {
            warmed.add(`av:${img}`);
            avatars.push(img);
          }
          if (typeof logo === 'string' && logo.trim() !== '' && !warmed.has(`logo:${logo}`)) {
            warmed.add(`logo:${logo}`);
            logos.push(logo);
          }
        }
        if (avatars.length + logos.length >= MAX_NEW_PER_UPDATE) break;
      }
      return { avatars, logos };
    };

    // Initial scan
    const myApps = queryClient.getQueryData<JobLike[]>(['my-applications', userId]);
    const availableJobs = queryClient.getQueryData<JobLike[]>(['available-jobs']);
    const conversations = queryClient.getQueryData<ConversationLike[]>(['conversations', userId]);

    warmLogos(collectFromJobsArray(myApps));
    warmLogos(collectFromJobsArray(availableJobs));
    const initialConv = collectFromConversations(conversations);
    warmAvatars(initialConv.avatars);
    warmLogos(initialConv.logos);

    // Lyssna på framtida cache-uppdateringar
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const key = event.query.queryKey;
      if (!Array.isArray(key)) return;
      const head = key[0];
      const data = event.query.state.data;

      if (head === 'my-applications' && key[1] === userId) {
        warmLogos(collectFromJobsArray(data as JobLike[] | undefined));
        return;
      }
      if (head === 'available-jobs') {
        warmLogos(collectFromJobsArray(data as JobLike[] | undefined));
        return;
      }
      if (head === 'optimized-job-search') {
        // Infinite query → data.pages är arrayer av jobb
        const pages = (data as { pages?: JobLike[][] } | undefined)?.pages;
        if (!Array.isArray(pages)) return;
        const flat: JobLike[] = [];
        for (const page of pages) {
          if (Array.isArray(page)) flat.push(...page);
        }
        warmLogos(collectFromJobsArray(flat));
        return;
      }
      if (head === 'conversations' && key[1] === userId) {
        const result = collectFromConversations(data as ConversationLike[] | undefined);
        warmAvatars(result.avatars);
        warmLogos(result.logos);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, userRole?.role, queryClient]);
}
