import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCachedProfile, readPersistentCache, writePersistentCache } from '@/lib/performanceGuards';
import { measurePerformance } from '@/lib/realtimePerformance';
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveCandidateMedia } from '@/lib/candidateMedia';
import { syncProfileMediaVersions } from '@/lib/profileMediaVersions';
import { chunk } from '@/lib/fetchAllPages';
import { notesCache } from '@/components/candidateProfile/candidateProfileCache';

import { useAuth } from '@/hooks/useAuth';

// Types for criterion results
export interface CriterionResult {
  criterion_id: string;
  result: 'match' | 'no_match' | 'no_data';
  reasoning?: string;
  title: string;
}

export interface JobApplication {
  id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: number;
  location: string;
  bio: string;
  cv_url: string;
  employment_status: string;
  availability: string;
  applied_at: string;
  status: 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';
  custom_answers: any;
  questions_snapshot?: any;
  viewed_at: string | null;
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean;
  rating: number;
  criterionResults?: CriterionResult[];
  last_active_at: string | null;
  city: string | null;
}

export interface JobPosting {
  id: string;
  title: string;
  location: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  removed_applicants_count?: number | null;
  created_at: string;
  expires_at: string | null;
  employer_id: string;
  employer_profile?: {
    first_name: string | null;
    last_name: string | null;
    profile_image_url: string | null;
  };
}

/**
 * 📄 SIDSTORLEK
 * Vi hämtar ansökningar i sidor om 200 rader. Första sidan renderas direkt,
 * resten strömmas in i bakgrunden under idle tills allt är laddat (eller taket
 * nås). Det gör att en annons med 1 000 sökande målar upp lika snabbt som en
 * med 50 — skillnaden är bara hur många bakgrundssidor som hämtas efteråt.
 */
export const APPLICATIONS_PAGE_SIZE = 200;
/** Hård spärr så en extrem annons aldrig kan äta upp minnet i webbläsaren. */
export const APPLICATIONS_MAX_ROWS = 5000;
/** `.in(...)` blir en URL — dela upp id-listor så den aldrig blir för lång. */
const IN_CHUNK = 200;
/** Postgrest returnerar max 1000 rader per anrop — paginera kriterieresultaten. */
const ROWS_PER_REQUEST = 1000;

// Fetch job details with employer profile
async function fetchJobDetails(jobId: string, userId: string): Promise<JobPosting | null> {
  // Don't filter by employer_id — RLS + can_view_job_application handles org-wide access
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) throw error;
  if (!data) return null;

  // Fetch employer profile
  const profileData = await fetchCachedProfile(data.employer_id);

  return {
    ...data,
    employer_profile: profileData || undefined
  };
}

/** Hämta betyg för en uppsättning kandidater — chunkat så `in()` aldrig spricker. */
async function fetchRatings(userId: string, applicantIds: string[]): Promise<Map<string, number>> {
  const ratings = new Map<string, number>();
  const groups = chunk(applicantIds, IN_CHUNK);

  // Legacy först (my_candidates), canonical sist (candidate_ratings) så den vinner.
  for (const ids of groups) {
    const { data } = await supabase
      .from('my_candidates')
      .select('applicant_id, rating')
      .eq('recruiter_id', userId)
      .in('applicant_id', ids);
    (data || []).forEach((mc) => {
      if (mc.rating) ratings.set(mc.applicant_id, mc.rating);
    });
  }

  for (const ids of groups) {
    const { data } = await supabase
      .from('candidate_ratings')
      .select('applicant_id, rating')
      .eq('recruiter_id', userId)
      .in('applicant_id', ids);
    (data || []).forEach((r) => ratings.set(r.applicant_id, r.rating || 0));
  }

  return ratings;
}

/**
 * Kriterieresultat för en uppsättning utvärderingar.
 * Tidigare gjordes detta med ett enda `.in()` — vilket tyst tappade rader så
 * fort resultaten passerade 1 000 (≈250 sökande med 4 kriterier). Nu chunkas
 * id-listan OCH varje chunk pagineras.
 */
async function fetchCriterionResults(
  evaluationIds: string[],
  criteriaMap: Map<string, string>,
): Promise<Map<string, CriterionResult[]>> {
  const byEvaluation = new Map<string, CriterionResult[]>();

  for (const ids of chunk(evaluationIds, IN_CHUNK)) {
    for (let from = 0; ; from += ROWS_PER_REQUEST) {
      const { data, error } = await supabase
        .from('criterion_results')
        .select('evaluation_id, criterion_id, result, reasoning')
        .in('evaluation_id', ids)
        .order('evaluation_id', { ascending: true })
        .order('criterion_id', { ascending: true })
        .range(from, from + ROWS_PER_REQUEST - 1);

      if (error) break;
      const rows = data || [];
      rows.forEach((cr) => {
        const existing = byEvaluation.get(cr.evaluation_id) || [];
        existing.push({
          criterion_id: cr.criterion_id,
          result: cr.result as 'match' | 'no_match' | 'no_data',
          reasoning: cr.reasoning || undefined,
          title: criteriaMap.get(cr.criterion_id) || 'Okänt kriterium',
        });
        byEvaluation.set(cr.evaluation_id, existing);
      });
      if (rows.length < ROWS_PER_REQUEST) break;
    }
  }

  return byEvaluation;
}

/** Berika en sida råa ansökningsrader med betyg, media, aktivitet och kriterier. */
async function hydrateApplications(
  applicationsData: any[],
  jobId: string,
  userId: string,
): Promise<JobApplication[]> {
  if (applicationsData.length === 0) return [];

  const applicantIds = applicationsData.map((a) => a.applicant_id);

  const [ratingsByApplicant, criteriaResult, evaluationsResult] = await Promise.all([
    fetchRatings(userId, applicantIds),
    supabase.from('job_criteria').select('id, title').eq('job_id', jobId),
    (async () => {
      const rows: { id: string; applicant_id: string }[] = [];
      for (const ids of chunk(applicantIds, IN_CHUNK)) {
        const { data } = await supabase
          .from('candidate_evaluations')
          .select('id, applicant_id')
          .eq('job_id', jobId)
          .in('applicant_id', ids);
        rows.push(...((data || []) as { id: string; applicant_id: string }[]));
      }
      return rows;
    })(),
  ]);

  const criteriaMap = new Map<string, string>();
  (criteriaResult.data || []).forEach((c) => criteriaMap.set(c.id, c.title));

  const evaluationByApplicant = new Map<string, string>();
  evaluationsResult.forEach((e) => evaluationByApplicant.set(e.applicant_id, e.id));

  const evaluationIds = evaluationsResult.map((e) => e.id);
  const resultsByEvaluation =
    evaluationIds.length > 0
      ? await fetchCriterionResults(evaluationIds, criteriaMap)
      : new Map<string, CriterionResult[]>();

  // Media + senaste aktivitet i batch-RPC:er — chunkade så även 1 000 sökande går igenom.
  const mediaByApplicant = new Map<
    string,
    { profile_image_url: string | null; video_url: string | null; is_profile_video: boolean | null; city: string | null }
  >();
  const activityByApplicant = new Map<string, { last_active_at: string | null }>();

  for (const ids of chunk(applicantIds, IN_CHUNK)) {
    const [{ data: batchMediaData }, activityResult] = await Promise.all([
      measurePerformance('matching', () =>
        supabase.rpc('get_applicant_profile_media_batch', { p_applicant_ids: ids, p_employer_id: userId }),
      ),
      measurePerformance('matching', () =>
        supabase.rpc('get_applicant_latest_activity', { p_applicant_ids: ids, p_employer_id: userId }),
      ),
    ]);

    if (batchMediaData && Array.isArray(batchMediaData)) {
      batchMediaData.forEach((row: any) => {
        mediaByApplicant.set(row.applicant_id, {
          profile_image_url: row.profile_image_url,
          video_url: row.video_url,
          is_profile_video: row.is_profile_video,
          city: row.city || null,
        });
      });
      // Auto-invalidera bildcachen när kandidaten bytt profilbild/video
      syncProfileMediaVersions(batchMediaData as any);
    }

    (activityResult.data || []).forEach((a: { applicant_id: string; last_active_at: string | null }) => {
      activityByApplicant.set(a.applicant_id, { last_active_at: a.last_active_at });
    });
  }

  return applicationsData.map((app) => {
    const liveMedia =
      mediaByApplicant.get(app.applicant_id) || { profile_image_url: null, video_url: null, is_profile_video: false, city: null };
    const media = resolveCandidateMedia(app as any, liveMedia);
    const evalId = evaluationByApplicant.get(app.applicant_id);
    const criterionResults = evalId ? resultsByEvaluation.get(evalId) || [] : [];
    const activity = activityByApplicant.get(app.applicant_id);

    return {
      ...app,
      profile_image_url: media.profile_image_url,
      video_url: media.video_url,
      is_profile_video: media.is_profile_video || false,
      rating: ratingsByApplicant.get(app.applicant_id) || 0,
      criterionResults,
      last_active_at: activity?.last_active_at || null,
      city: liveMedia.city || null,
    } as JobApplication;
  });
}

/** Hämta EN sida ansökningar (keyset-liknande range med stabil sortering). */
async function fetchApplicationsPage(
  jobId: string,
  userId: string,
  offset: number,
  limit: number = APPLICATIONS_PAGE_SIZE,
): Promise<{ rows: JobApplication[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const raw = data || [];
  const rows = await hydrateApplications(raw, jobId, userId);
  return { rows, hasMore: raw.length === limit };
}

/** Stegtotaler direkt från databasen — oberoende av hur många rader som laddats. */
async function fetchStageCounts(jobId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('count_job_applications_per_stage', { p_job_id: jobId });
  if (error) throw error;
  const out: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    out[row.status] = Number(row.application_count) || 0;
  });
  return out;
}

// localStorage cache for job details
const JOB_DETAIL_CACHE_KEY = 'parium_job_detail_v2_';
const JOB_APPS_CACHE_KEY = 'parium_job_apps_v3_';
const JOB_DETAIL_TTL = 15 * 60 * 1000;
const JOB_APPS_TTL = 2 * 60 * 1000;
/** Hur många rader vi sparar lokalt. Fler än så: cachen märks som partiell. */
const JOB_APPS_CACHE_ROWS = 300;

interface CachedApplications {
  rows: JobApplication[];
  /** true = cachen innehåller inte alla rader; UI:t måste vänta in nätverket. */
  partial: boolean;
}

function readJobDetailCache(jobId: string): JobPosting | null {
  return readPersistentCache<JobPosting>(
    JOB_DETAIL_CACHE_KEY + jobId,
    JOB_DETAIL_TTL,
    (data): data is JobPosting => Boolean(data && typeof data === 'object' && typeof (data as JobPosting).id === 'string'),
  );
}

function writeJobDetailCache(jobId: string, data: JobPosting): void {
  writePersistentCache(JOB_DETAIL_CACHE_KEY + jobId, data);
}

function readJobAppsCache(jobId: string): CachedApplications | null {
  return readPersistentCache<CachedApplications>(
    JOB_APPS_CACHE_KEY + jobId,
    JOB_APPS_TTL,
    (data): data is CachedApplications =>
      Boolean(data && typeof data === 'object' && Array.isArray((data as CachedApplications).rows)),
  );
}

function writeJobAppsCache(jobId: string, data: JobApplication[]): void {
  writePersistentCache<CachedApplications>(JOB_APPS_CACHE_KEY + jobId, {
    rows: data.slice(0, JOB_APPS_CACHE_ROWS),
    partial: data.length > JOB_APPS_CACHE_ROWS,
  });
}

export function useJobDetailsData(jobId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Flytt-lås ───────────────────────────────────────────────────────────
  // Exakt samma princip som i Mina kandidater: när ett kort dras till ett nytt
  // steg får INGEN senare datakälla (omhämtning från läsreplika, realtidseko,
  // bakgrundsström) skriva tillbaka det gamla steget. Utan detta hann kortet
  // hoppa tillbaka till ursprungskolumnen och sedan vidare igen — den där
  // blinkningen. Överskrivningen lever tills servern bekräftat samma status.
  const pendingStatusRef = useRef<Map<string, { status: string; at: number }>>(new Map());
  const [pendingVersion, setPendingVersion] = useState(0);
  const PENDING_TTL_MS = 15000;

  const setPendingStatus = useCallback((applicationId: string, status: string) => {
    pendingStatusRef.current.set(applicationId, { status, at: Date.now() });
    setPendingVersion(v => v + 1);
  }, []);

  const clearPendingStatus = useCallback((applicationId: string, confirmedStatus?: string) => {
    const entry = pendingStatusRef.current.get(applicationId);
    if (!entry) return;
    if (confirmedStatus !== undefined && entry.status !== confirmedStatus) return;
    pendingStatusRef.current.delete(applicationId);
    setPendingVersion(v => v + 1);
  }, []);

  // Job details query
  const jobQuery = useQuery({
    queryKey: ['job-details', jobId],
    queryFn: async () => {
      const result = await fetchJobDetails(jobId!, user!.id);
      if (result && jobId) writeJobDetailCache(jobId, result);
      return result;
    },
    enabled: !!jobId && !!user,
    staleTime: 5 * 60 * 1000, // 5 min – allows refetch on mount when stale
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    initialData: () => {
      if (!jobId) return undefined;
      return readJobDetailCache(jobId) ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!jobId) return undefined;
      // Mark cached data as 6 min old so it's always stale on first mount → triggers background refetch
      return readJobDetailCache(jobId) ? Date.now() - 6 * 60 * 1000 : undefined;
    },
  });

  // Applications — FÖRSTA SIDAN. Resten strömmas in av effekten längre ner.
  const applicationsQuery = useQuery({
    queryKey: ['job-applications', jobId],
    queryFn: async () => {
      const { rows } = await fetchApplicationsPage(jobId!, user!.id, 0);
      if (jobId) writeJobAppsCache(jobId, rows);
      return rows;
    },
    enabled: !!jobId && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    initialData: () => {
      if (!jobId) return undefined;
      const cached = readJobAppsCache(jobId);
      return cached?.rows ?? undefined;
    },
    initialDataUpdatedAt: () => {
      if (!jobId) return undefined;
      return readJobAppsCache(jobId) ? Date.now() - 6 * 60 * 1000 : undefined;
    },
  });

  // Serverside-totaler per steg — visas i kolumnrubrikerna oavsett hur många
  // rader som hunnit laddas ner.
  const stageCountsQuery = useQuery({
    queryKey: ['job-stage-counts', jobId],
    queryFn: () => fetchStageCounts(jobId!),
    enabled: !!jobId && !!user,
    staleTime: 60 * 1000,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const stageTotals = stageCountsQuery.data ?? null;
  const totalApplications = stageTotals
    ? Object.values(stageTotals).reduce((sum, n) => sum + n, 0)
    : null;

  const loadedCount = applicationsQuery.data?.length ?? 0;

  // ── Progressiv bakgrundsladdning ────────────────────────────────────────
  // Sida 1 syns direkt. Sida 2, 3, 4 … hämtas under idle och läggs till i
  // cachen utan att blinka. Avbryts direkt vid unmount eller byte av annons.
  const streamTokenRef = useRef(0);
  useEffect(() => {
    if (!jobId || !user) return;
    if (applicationsQuery.isLoading) return;
    const loaded = applicationsQuery.data?.length ?? 0;
    if (loaded === 0) return;
    // Redan komplett?
    if (totalApplications !== null && loaded >= Math.min(totalApplications, APPLICATIONS_MAX_ROWS)) return;
    if (loaded % APPLICATIONS_PAGE_SIZE !== 0) return; // sista sidan var kort → allt hämtat
    if (loaded >= APPLICATIONS_MAX_ROWS) return;

    const token = ++streamTokenRef.current;
    let cancelled = false;
    setIsLoadingMore(true);

    const run = async () => {
      let offset = loaded;
      while (!cancelled && streamTokenRef.current === token && offset < APPLICATIONS_MAX_ROWS) {
        let page: { rows: JobApplication[]; hasMore: boolean };
        try {
          page = await fetchApplicationsPage(jobId, user.id, offset);
        } catch {
          break;
        }
        if (cancelled || streamTokenRef.current !== token) return;
        if (page.rows.length === 0) break;

        queryClient.setQueryData(['job-applications', jobId], (old: JobApplication[] | undefined) => {
          const base = old ?? [];
          const seen = new Set(base.map((a) => a.id));
          const merged = [...base, ...page.rows.filter((r) => !seen.has(r.id))];
          writeJobAppsCache(jobId, merged);
          return merged;
        });

        if (!page.hasMore) break;
        offset += APPLICATIONS_PAGE_SIZE;
        // Andas mellan sidorna så scroll/drag aldrig hackar.
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled && streamTokenRef.current === token) setIsLoadingMore(false);
    };

    const idle = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(() => void run(), { timeout: 1500 })
      : window.setTimeout(() => void run(), 300);

    return () => {
      cancelled = true;
      streamTokenRef.current++;
      setIsLoadingMore(false);
      if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(idle);
      else window.clearTimeout(idle as number);
    };
  }, [jobId, user, applicationsQuery.isLoading, applicationsQuery.data?.length, totalApplications, queryClient]);

  // Real-time subscription for application updates AND criterion results
  useEffect(() => {
    if (!jobId || !user) return;

    // INSERT-vågor (t.ex. när en annons går ut i ett nyhetsbrev) får inte
    // trigga en full omhämtning per rad — samla ihop dem i ett fönster.
    let invalidateTimer: number | undefined;
    const scheduleInvalidate = () => {
      if (invalidateTimer !== undefined) return;
      invalidateTimer = window.setTimeout(() => {
        invalidateTimer = undefined;
        queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-stage-counts', jobId] });
      }, 1200);
    };

    const channel = supabase
      .channel(`job-applications-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          // Optimistically update the cache
          if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData(['job-applications', jobId], (old: JobApplication[] | undefined) => {
              if (!old) return old;
              return old.map(app => 
                app.id === payload.new.id 
                  ? { ...app, ...payload.new }
                  : app
              );
            });
            // Statusbyten påverkar stegtotalerna.
            queryClient.invalidateQueries({ queryKey: ['job-stage-counts', jobId] });
          } else {
            // INSERT/DELETE → debouncad omhämtning
            scheduleInvalidate();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_evaluations',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          // When evaluation completes, refetch to get criterion results
          if (payload.eventType === 'UPDATE' && payload.new.status === 'completed') {
            scheduleInvalidate();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_ratings',
          filter: `recruiter_id=eq.${user.id}`,
        },
        (payload) => {
          // Betyg sätts även från Mina kandidater/kandidatlistan — spegla direkt
          // in i annonsvyn så att stjärnorna aldrig visar olika värden.
          const row: any = payload.new || payload.old;
          if (!row?.applicant_id) return;
          queryClient.setQueryData(['job-applications', jobId], (old: JobApplication[] | undefined) => {
            if (!old) return old;
            const next = old.map(app =>
              app.applicant_id === row.applicant_id
                ? { ...app, rating: payload.eventType === 'DELETE' ? 0 : (row.rating ?? 0) }
                : app
            );
            if (jobId) writeJobAppsCache(jobId, next);
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidate_notes' },
        (payload) => {
          // Noteringar ligger i en egen modulcache — släng posten för den
          // kandidat som ändrades så nästa öppning hämtar färskt.
          const row: any = payload.new || payload.old;
          if (row?.applicant_id) notesCache.delete(row.applicant_id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
          filter: `recruiter_id=eq.${user.id}`,
        },
        () => {
          // Listtillhörighet ändrad (t.ex. från Mina kandidater) — låt sidan
          // uppdatera sin karta över vilka som redan ligger i en lista.
          queryClient.invalidateQueries({ queryKey: ['job-my-candidates-map', jobId] });
        }
      )
      .subscribe();


    return () => {
      if (invalidateTimer !== undefined) window.clearTimeout(invalidateTimer);
      supabase.removeChannel(channel);
    };
  }, [jobId, user, queryClient]);

  // Helper to update application locally (both React Query cache AND localStorage)
  const updateApplicationLocally = useCallback((applicationId: string, updates: Partial<JobApplication>) => {
    queryClient.setQueryData(['job-applications', jobId], (old: JobApplication[] | undefined) => {
      if (!old) return old;
      const updated = old.map(app => 
        app.id === applicationId ? { ...app, ...updates } : app
      );
      // Sync to localStorage so page refresh shows correct data
      if (jobId) writeJobAppsCache(jobId, updated);
      return updated;
    });
    if (updates.status) {
      // Lås steget lokalt tills servern bekräftat det.
      setPendingStatus(applicationId, updates.status as string);
      // Räkna om totalerna först när flytten hunnit landa — en omedelbar
      // omhämtning läser ofta upp gamla siffror och fick rubrikerna att hoppa.
      if (countsTimerRef.current !== undefined) window.clearTimeout(countsTimerRef.current);
      countsTimerRef.current = window.setTimeout(() => {
        countsTimerRef.current = undefined;
        queryClient.invalidateQueries({ queryKey: ['job-stage-counts', jobId] });
      }, 1200);
    }
  }, [queryClient, jobId, setPendingStatus]);

  // Helper to update job locally
  const updateJobLocally = useCallback((updates: Partial<JobPosting>) => {
    queryClient.setQueryData(['job-details', jobId], (old: JobPosting | null | undefined) => {
      if (!old) return old;
      return { ...old, ...updates };
    });
  }, [queryClient, jobId]);

  // Refetch both
  const refetch = useCallback(() => {
    jobQuery.refetch();
    applicationsQuery.refetch();
    stageCountsQuery.refetch();
  }, [jobQuery, applicationsQuery, stageCountsQuery]);

  return {
    job: jobQuery.data ?? null,
    applications: applicationsQuery.data ?? [],
    stageTotals,
    totalApplications,
    loadedCount,
    isLoadingMore,
    isLoading: jobQuery.isLoading || applicationsQuery.isLoading,
    isFetching: jobQuery.isFetching || applicationsQuery.isFetching,
    error: jobQuery.error || applicationsQuery.error,
    updateApplicationLocally,
    updateJobLocally,
    refetch,
  };
}

// Prefetch function to call from job list
export function prefetchJobDetails(jobId: string, userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.prefetchQuery({
    queryKey: ['job-details', jobId],
    queryFn: () => fetchJobDetails(jobId, userId),
    staleTime: Infinity,
  });
  queryClient.prefetchQuery({
    queryKey: ['job-applications', jobId],
    queryFn: async () => (await fetchApplicationsPage(jobId, userId, 0)).rows,
    staleTime: Infinity,
  });
  queryClient.prefetchQuery({
    queryKey: ['job-stage-counts', jobId],
    queryFn: () => fetchStageCounts(jobId),
    staleTime: Infinity,
  });
}
