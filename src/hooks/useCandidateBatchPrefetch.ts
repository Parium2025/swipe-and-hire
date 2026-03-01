import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { mapRawToApplicationData } from '@/lib/candidateApplicationMapper';
import type { ApplicationData } from '@/hooks/useApplicationsData';

const CANDIDATE_APPLICATIONS_CACHE_PREFIX = 'candidate_apps_cache_v1_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Manages the per-applicant application cache (localStorage with TTL).
 * Previously ~200 lines inlined inside CandidatesTable — now a dedicated
 * hook that also handles batch prefetching on mount.
 *
 * 100 % same behaviour, zero visual changes.
 */
export function useCandidateBatchPrefetch(applications: ApplicationData[]) {
  const { user } = useAuth();

  // ── Cache read / write ──────────────────────────────

  const getCacheKey = useCallback(
    (applicantId: string) => `${CANDIDATE_APPLICATIONS_CACHE_PREFIX}${user?.id || 'anon'}_${applicantId}`,
    [user?.id]
  );

  const readCache = useCallback(
    (applicantId: string): ApplicationData[] | null => {
      if (!applicantId || typeof window === 'undefined') return null;
      try {
        const raw = localStorage.getItem(getCacheKey(applicantId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { items?: ApplicationData[]; cachedAt?: number };
        if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
        if (parsed.cachedAt && Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
          localStorage.removeItem(getCacheKey(applicantId));
          return null;
        }
        return parsed.items;
      } catch {
        return null;
      }
    },
    [getCacheKey]
  );

  const writeCache = useCallback(
    (applicantId: string, items: ApplicationData[]) => {
      if (!applicantId || items.length === 0 || typeof window === 'undefined') return;
      try {
        localStorage.setItem(getCacheKey(applicantId), JSON.stringify({ items, cachedAt: Date.now() }));
      } catch {
        // Ignore storage errors
      }
    },
    [getCacheKey]
  );

  // ── Single-candidate fetch ──────────────────────────

  const fetchForApplicant = useCallback(
    async (seedApplication: ApplicationData): Promise<ApplicationData[]> => {
      if (!user || !seedApplication?.applicant_id) return [seedApplication];

      const { data: orgJobs, error: jobsError } = await supabase
        .from('job_postings')
        .select('id, title')
        .eq('employer_id', user.id);

      if (jobsError) throw jobsError;
      if (!orgJobs || orgJobs.length === 0) return [seedApplication];

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
        .eq('applicant_id', seedApplication.applicant_id)
        .in('job_id', jobIds);

      if (appError) throw appError;

      const transformed = (apps || []).map((app: any) =>
        mapRawToApplicationData(app, {
          jobTitle: app.job_postings?.title,
          fallbackProfileImageUrl: seedApplication.profile_image_url,
          fallbackVideoUrl: seedApplication.video_url,
          fallbackIsProfileVideo: seedApplication.is_profile_video,
        })
      );

      return transformed.length > 0 ? transformed : [seedApplication];
    },
    [user]
  );

  // ── Hover prefetch (single candidate) ──────────────

  const prefetchInFlightRef = useRef<Set<string>>(new Set());

  const prefetchSingle = useCallback(
    (application: ApplicationData) => {
      if (!user || !application.applicant_id) return;
      if (readCache(application.applicant_id)?.length) return;
      if (prefetchInFlightRef.current.has(application.applicant_id)) return;

      prefetchInFlightRef.current.add(application.applicant_id);
      fetchForApplicant(application)
        .then((apps) => {
          if (apps.length > 0) writeCache(application.applicant_id, apps);
        })
        .catch(() => {})
        .finally(() => {
          prefetchInFlightRef.current.delete(application.applicant_id);
        });
    },
    [user, fetchForApplicant, readCache, writeCache]
  );

  // ── Batch prefetch on mount ─────────────────────────
  // Uses a hash of applicant IDs (not count) to correctly detect changes
  // when a candidate is removed and a new one added simultaneously.

  const applicantIdsHash = useMemo(() => {
    const ids = applications.map((a) => a.applicant_id).filter(Boolean);
    ids.sort();
    return ids.join('|');
  }, [applications]);

  const prevHashRef = useRef('');

  useEffect(() => {
    if (!user || applications.length === 0) return;
    if (applicantIdsHash === prevHashRef.current) return;
    prevHashRef.current = applicantIdsHash;

    // Find unique applicant IDs that don't have a cache yet
    const uncachedApplicants = new Map<string, ApplicationData>();
    for (const app of applications) {
      if (!app.applicant_id) continue;
      if (uncachedApplicants.has(app.applicant_id)) continue;
      if (readCache(app.applicant_id)?.length) continue;
      uncachedApplicants.set(app.applicant_id, app);
    }

    if (uncachedApplicants.size === 0) return;

    const doBatchPrefetch = async () => {
      try {
        const { data: orgJobs, error: jobsError } = await supabase
          .from('job_postings')
          .select('id, title')
          .eq('employer_id', user.id);

        if (jobsError || !orgJobs?.length) return;
        const jobIds = orgJobs.map((j) => j.id);
        const jobTitleMap = new Map(orgJobs.map((j) => [j.id, j.title]));
        const applicantIds = Array.from(uncachedApplicants.keys());

        const CHUNK_SIZE = 200;
        let allApps: any[] = [];

        for (let i = 0; i < applicantIds.length; i += CHUNK_SIZE) {
          const chunk = applicantIds.slice(i, i + CHUNK_SIZE);
          const { data: chunkApps, error: appError } = await supabase
            .from('job_applications')
            .select(`
              id, job_id, applicant_id, first_name, last_name, email, phone,
              location, bio, cv_url, age, employment_status, work_schedule,
              availability, custom_answers, status, applied_at, updated_at,
              profile_image_snapshot_url, video_snapshot_url
            `)
            .in('applicant_id', chunk)
            .in('job_id', jobIds)
            .limit(1000);

          if (appError) return;
          if (chunkApps) allApps = allApps.concat(chunkApps);
        }

        if (allApps.length === 0) return;

        // Group by applicant_id
        const grouped = new Map<string, typeof allApps>();
        for (const app of allApps) {
          const existing = grouped.get(app.applicant_id) || [];
          existing.push(app);
          grouped.set(app.applicant_id, existing);
        }

        // Write cache for each applicant
        for (const [applicantId, apps] of grouped) {
          const seed = uncachedApplicants.get(applicantId);
          const transformed = apps.map((app: any) =>
            mapRawToApplicationData(app, {
              jobTitle: jobTitleMap.get(app.job_id),
              fallbackProfileImageUrl: seed?.profile_image_url,
              fallbackVideoUrl: seed?.video_url,
              fallbackIsProfileVideo: seed?.is_profile_video,
            })
          );
          if (transformed.length > 0) writeCache(applicantId, transformed);
        }

        console.log('[BatchPrefetch] Warmed cache for', grouped.size, 'candidates');
      } catch (err) {
        console.error('[BatchPrefetch] Error:', err);
      }
    };

    const timer = setTimeout(doBatchPrefetch, 500);
    return () => clearTimeout(timer);
  }, [user, applicantIdsHash, applications, readCache, writeCache]);

  return {
    readCache,
    writeCache,
    fetchForApplicant,
    prefetchSingle,
  };
}
