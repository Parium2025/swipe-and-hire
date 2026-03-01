import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { mapRawToApplicationData } from '@/lib/candidateApplicationMapper';
import type { ApplicationData } from '@/hooks/useApplicationsData';

const CANDIDATE_APPLICATIONS_CACHE_PREFIX = 'candidate_apps_cache_v1_';
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Manages fetching all applications for a selected candidate in MyCandidates.
 * Shares the same localStorage cache format as useCandidateBatchPrefetch.
 */
export function useMyCandidateApplications(
  applicantId: string | null,
  dialogOpen: boolean,
  fallback?: {
    profile_image_url?: string | null;
    video_url?: string | null;
    is_profile_video?: boolean | null;
  }
) {
  const { user } = useAuth();
  const [allApplications, setAllApplications] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(false);

  const getCacheKey = useCallback(
    (aid: string) => `${CANDIDATE_APPLICATIONS_CACHE_PREFIX}${user?.id || 'anon'}_${aid}`,
    [user?.id]
  );

  const readCache = useCallback(
    (aid: string): ApplicationData[] | null => {
      if (!aid) return null;
      try {
        const raw = localStorage.getItem(getCacheKey(aid));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.items?.length) return null;
        if (parsed.cachedAt && Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
        return parsed.items;
      } catch {
        return null;
      }
    },
    [getCacheKey]
  );

  const writeCache = useCallback(
    (aid: string, items: ApplicationData[]) => {
      if (!aid || items.length === 0) return;
      try {
        localStorage.setItem(getCacheKey(aid), JSON.stringify({ items, cachedAt: Date.now() }));
      } catch {}
    },
    [getCacheKey]
  );

  useEffect(() => {
    if (!applicantId || !user || !dialogOpen) {
      setAllApplications([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Serve from cache instantly
    const cached = readCache(applicantId);
    if (cached?.length) {
      setAllApplications(cached);
    }

    const fetchAll = async () => {
      try {
        const { data: orgJobs, error: jobsError } = await supabase
          .from('job_postings')
          .select('id, title')
          .eq('employer_id', user.id);

        if (jobsError) throw jobsError;
        if (!orgJobs?.length) {
          if (!cancelled) setAllApplications([]);
          return;
        }

        const jobIds = orgJobs.map((j) => j.id);

        const { data: apps, error: appError } = await supabase
          .from('job_applications')
          .select(`
            id, job_id, applicant_id, first_name, last_name, email, phone,
            location, bio, cv_url, age, employment_status, work_schedule,
            availability, custom_answers, status, applied_at, updated_at,
            profile_image_snapshot_url, video_snapshot_url,
            job_postings!inner(title)
          `)
          .eq('applicant_id', applicantId)
          .in('job_id', jobIds);

        if (appError) throw appError;

        const transformed = (apps || []).map((app: any) =>
          mapRawToApplicationData(app, {
            jobTitle: app.job_postings?.title,
            fallbackProfileImageUrl: fallback?.profile_image_url,
            fallbackVideoUrl: fallback?.video_url,
            fallbackIsProfileVideo: fallback?.is_profile_video,
          })
        );

        if (!cancelled) {
          setAllApplications(transformed);
          if (transformed.length > 0) writeCache(applicantId, transformed);
        }
      } catch (error) {
        console.error('Error fetching candidate applications:', error);
        if (!cancelled && !cached?.length) {
          setAllApplications([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [applicantId, user?.id, dialogOpen, readCache, writeCache, fallback?.profile_image_url, fallback?.video_url, fallback?.is_profile_video]);

  return { allApplications, loading, readCache };
}
