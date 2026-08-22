import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  readCandidateApplicationsCache,
  writeCandidateApplicationsCache,
  fetchApplicationsForApplicant,
  fetchApplicationsForApplicants,
  isCandidateApplicationsCacheFresh,
} from '@/lib/candidateApplicationsSource';
import type { ApplicationData } from '@/hooks/useApplicationsData';

/**
 * Prefetch + cache av "alla ansökningar per kandidat" för /candidates.
 *
 * All hämtnings- och cachelogik ligger i `candidateApplicationsSource` så att
 * /candidates och /my-candidates garanterat ger samma svar för samma kandidat.
 * Den här hooken sköter bara *när* det hämtas (mount-batch och hover).
 */
export function useCandidateBatchPrefetch(applications: ApplicationData[]) {
  const { user } = useAuth();
  const userId = user?.id;

  const readCache = useCallback(
    (applicantId: string) => readCandidateApplicationsCache(userId, applicantId),
    [userId],
  );

  const writeCache = useCallback(
    (applicantId: string, items: ApplicationData[]) =>
      writeCandidateApplicationsCache(userId, applicantId, items),
    [userId],
  );

  const fetchForApplicant = useCallback(
    async (seedApplication: ApplicationData): Promise<ApplicationData[]> => {
      if (!userId || !seedApplication?.applicant_id) return [seedApplication];
      const apps = await fetchApplicationsForApplicant(userId, seedApplication.applicant_id, {
        profile_image_url: seedApplication.profile_image_url,
        video_url: seedApplication.video_url,
        is_profile_video: seedApplication.is_profile_video,
      });
      return apps.length > 0 ? apps : [seedApplication];
    },
    [userId],
  );

  // ── Hover prefetch (en kandidat) ────────────────────

  const prefetchInFlightRef = useRef<Set<string>>(new Set());

  const prefetchSingle = useCallback(
    (application: ApplicationData) => {
      if (!userId || !application.applicant_id) return;
      if (isCandidateApplicationsCacheFresh(userId, application.applicant_id)) return;
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
    [userId, fetchForApplicant, readCache, writeCache],
  );

  // ── Batch-prefetch vid mount ────────────────────────
  // Hashar applicant-ID:n (inte antal) så att "en bort + en ny" upptäcks.

  const applicantIdsHash = useMemo(() => {
    const ids = applications.map((a) => a.applicant_id).filter(Boolean);
    ids.sort();
    return ids.join('|');
  }, [applications]);

  const prevHashRef = useRef('');

  // `applications` är en ny arrayreferens vid varje render; håll den i en ref
  // så effekten bara körs när hashen (faktiska kandidater) ändras.
  const applicationsRef = useRef(applications);
  applicationsRef.current = applications;

  useEffect(() => {
    const applications = applicationsRef.current;
    if (!userId || applications.length === 0) return;
    if (applicantIdsHash === prevHashRef.current) return;
    prevHashRef.current = applicantIdsHash;

    const uncachedApplicants = new Map<string, ApplicationData>();
    for (const app of applications) {
      if (!app.applicant_id) continue;
      if (uncachedApplicants.has(app.applicant_id)) continue;
      if (isCandidateApplicationsCacheFresh(userId, app.applicant_id)) continue;
      uncachedApplicants.set(app.applicant_id, app);
    }

    if (uncachedApplicants.size === 0) return;

    const timer = setTimeout(async () => {
      try {
        const fallbacks = new Map(
          Array.from(uncachedApplicants.entries()).map(([id, seed]) => [
            id,
            {
              profile_image_url: seed.profile_image_url,
              video_url: seed.video_url,
              is_profile_video: seed.is_profile_video,
            },
          ]),
        );

        const grouped = await fetchApplicationsForApplicants(
          userId,
          Array.from(uncachedApplicants.keys()),
          fallbacks,
        );

        for (const [applicantId, apps] of grouped) {
          writeCache(applicantId, apps);
        }
      } catch (err) {
        console.error('[BatchPrefetch] Error:', err);
      }
    }, 120);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, applicantIdsHash, readCache, writeCache]);

  return {
    readCache,
    writeCache,
    fetchForApplicant,
    prefetchSingle,
  };
}
