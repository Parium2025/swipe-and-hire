import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { useAuth } from '@/hooks/useAuth';

/**
 * Shared hook for prefetching applications data.
 * Used by both EmployerLayout (on mount) and EmployerSidebar/TopNav (on hover).
 */
export const usePrefetchApplications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const prefetchApplications = useCallback(() => {
    if (!user) return;

    queryClient.prefetchInfiniteQuery({
      queryKey: ['applications', user.id, ''],
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        const from = (pageParam as number) * 25;
        const to = from + 25 - 1;

        const { data: baseData, error: baseError } = await supabase
          .from('job_applications')
          .select(`
            id, job_id, applicant_id, first_name, last_name, email, phone, location,
            bio, cv_url, age, employment_status, work_schedule, availability,
            custom_answers, status, applied_at, updated_at, job_postings!inner(title)
          `)
          .order('applied_at', { ascending: false })
          .range(from, to);

        if (baseError) throw baseError;
        if (!baseData) return { items: [], hasMore: false };

        const applicantIds = [...new Set(baseData.map((item: any) => item.applicant_id))];
        const profileMediaMap: Record<
          string,
          { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null }
        > = {};

        const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
          p_applicant_ids: applicantIds,
          p_employer_id: user.id,
        });

        if (batchMediaData && Array.isArray(batchMediaData)) {
          batchMediaData.forEach((row: any) => {
            profileMediaMap[row.applicant_id] = {
              profile_image_url: row.profile_image_url,
              video_url: row.video_url,
              is_profile_video: row.is_profile_video,
            };
          });
        }

        applicantIds.forEach((id) => {
          if (!profileMediaMap[id]) {
            profileMediaMap[id] = { profile_image_url: null, video_url: null, is_profile_video: null };
          }
        });

        const items = baseData.map((item: any) => {
          const media = profileMediaMap[item.applicant_id] || {
            profile_image_url: null, video_url: null, is_profile_video: null,
          };
          return {
            ...item,
            job_title: item.job_postings?.title || 'Okänt jobb',
            profile_image_url: media.profile_image_url,
            video_url: media.video_url,
            is_profile_video: media.is_profile_video,
            job_postings: undefined,
          };
        });

        // Prefetch avatars in background — matcha CandidateAvatar (40px, 2x retina)
        const AVATAR_TRANSFORM = { width: 40, height: 40, resize: 'cover' as const };
        setTimeout(() => {
          const paths = (items as any[])
            .map((i) => i.profile_image_url)
            .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
            .slice(0, 25);
          if (paths.length > 0) {
            Promise.all(paths.map((p) => prefetchMediaUrl(p, 'profile-image', 86400, AVATAR_TRANSFORM).catch(() => {}))).catch(() => {});
          }
        }, 0);

        return { items, hasMore: items.length === 25 };
      },
      staleTime: Infinity,
    });
  }, [user, queryClient]);

  return prefetchApplications;
};
