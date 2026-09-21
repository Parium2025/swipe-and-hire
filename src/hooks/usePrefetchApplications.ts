import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { useAuth } from '@/hooks/useAuth';
import { AVATAR_TRANSFORM } from '@/lib/mediaPresets';

/**
 * Förvärmning inför kandidatsidan (hover i sidomenyn/toppnavigeringen).
 *
 * Tidigare skrev den här hooken till nyckeln ['applications', userId, ''] med
 * sidnumrering som tal. Den riktiga listan (useApplicationsData) använder en
 * sexdelad nyckel och markörpaginering, så den förvärmda posten kunde aldrig
 * läsas — ren bortkastad trafik. Nu värmer vi i stället det som faktiskt gör
 * sidan snabb: samma databassökning som listan kör (svaret ligger varmt) och
 * kandidatbildernas signerade URL:er med exakt samma cache-nyckel som
 * avatarerna renderas med.
 */
const PAGE_SIZE = 25;
const THROTTLE_MS = 60_000;

export const usePrefetchApplications = () => {
  const { user } = useAuth();
  const lastRunRef = useRef(0);

  const prefetchApplications = useCallback(() => {
    if (!user) return;

    const now = Date.now();
    if (now - lastRunRef.current < THROTTLE_MS) return;
    lastRunRef.current = now;

    const conn = (navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('search_employer_candidates', {
          p_search: null,
          p_filters: [] as any,
          p_status: null,
          p_sort: 'applied_at',
          p_limit: PAGE_SIZE,
          p_offset: 0,
          p_with_count: true,
          p_cursor_applied_at: null,
          p_cursor_id: null,
          p_count_cap: 10000,
        } as any);
        if (error || !data) return;

        const rows = data as any[];
        const applicantIds = [...new Set(rows.map((r) => r.applicant_id))].filter(Boolean);
        if (applicantIds.length === 0) return;

        const { data: media } = await supabase.rpc('get_applicant_profile_media_batch', {
          p_applicant_ids: applicantIds,
          p_employer_id: user.id,
        });

        const paths = ((media as any[]) || [])
          .map((row) => row?.profile_image_url)
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
          .slice(0, PAGE_SIZE);

        if (paths.length === 0) return;
        await Promise.all(
          paths.map((p) => prefetchMediaUrl(p, 'profile-image', 86400, AVATAR_TRANSFORM).catch(() => {})),
        );
      } catch {
        // Förvärmning får aldrig störa UI.
      }
    })();
  }, [user]);

  return prefetchApplications;
};
