import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from '@/hooks/useAuth';
import { safeSetItem } from '@/lib/safeStorage';
import { useIsPremium } from '@/hooks/useIsPremium';
import { emitSavedJobsLimit } from '@/lib/premiumEvents';

const SAVED_JOBS_FREE_LIMIT = 3;

/**
 * 🚇 useSavedJobsCache — speglar useMyApplicationsCache-mönstret.
 *
 * Äger:
 *  - Query för sparade jobb (saved_jobs join job_postings)
 *  - Query för skippade jobb (swipe_actions där action='skipped')
 *  - LocalStorage-placeholder för instant load
 *  - Realtime-sync för job_postings-uppdateringar (applications_count, is_active, expires_at, branding)
 *  - Optimistic remove
 *
 * Resultat: SavedJobs.tsx blir tunn presentation, ingen tung mount-kostnad
 * under sidebar-stängningsanimationen.
 */

interface JobPostingShape {
  id: string;
  title: string;
  image_focus_position?: string | null;
  location: string | null;
  workplace_city: string | null;
  workplace_county: string | null;
  employment_type: string | null;
  job_image_url: string | null;
  job_image_desktop_url: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  applications_count: number | null;
  views_count: number | null;
  positions_count: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: string | null;
  salary_transparency: string | null;
  benefits: string[] | null;
  workplace_name: string | null;
  company_logo_url: string | null;
  overlay_text_color: string | null;
}

export interface SavedJob {
  id: string;
  job_id: string;
  created_at: string;
  job_postings: JobPostingShape | null;
}

export interface SkippedJob {
  id: string;
  job_id: string;
  created_at: string;
  job_postings: JobPostingShape | null;
}

type JobPostingInput = JobPostingShape | null | undefined;

const SAVED_CACHE_KEY = 'parium_saved_jobs_full_cache_v1';
const SKIPPED_CACHE_KEY = 'parium_skipped_jobs_full_cache_v1';

interface CacheEnvelope<T> {
  items: T[];
  userId: string;
  timestamp: number;
}

const asNullableString = (value: unknown): string | null => typeof value === 'string' ? value : null;
const asRequiredString = (value: unknown): string | null => {
  const normalized = asNullableString(value)?.trim();
  return normalized ? normalized : null;
};
const asNullableNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const asStringArray = (value: unknown): string[] | null => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string')
  : null;

function normalizeJobPostingShape(input: unknown): JobPostingShape | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const record = input as Record<string, unknown>;
  const id = asRequiredString(record.id);
  const title = asRequiredString(record.title);
  const createdAt = asRequiredString(record.created_at);

  if (!id || !title || !createdAt) return null;

  return {
    id,
    title,
    image_focus_position: asNullableString(record.image_focus_position),
    location: asNullableString(record.location),
    workplace_city: asNullableString(record.workplace_city),
    workplace_county: asNullableString(record.workplace_county),
    employment_type: asNullableString(record.employment_type),
    job_image_url: asNullableString(record.job_image_url),
    job_image_desktop_url: asNullableString(record.job_image_desktop_url),
    is_active: typeof record.is_active === 'boolean' ? record.is_active : false,
    created_at: createdAt,
    expires_at: asNullableString(record.expires_at),
    applications_count: asNullableNumber(record.applications_count),
    views_count: asNullableNumber(record.views_count),
    positions_count: asNullableNumber(record.positions_count),
    salary_min: asNullableNumber(record.salary_min),
    salary_max: asNullableNumber(record.salary_max),
    salary_type: asNullableString(record.salary_type),
    salary_transparency: asNullableString(record.salary_transparency),
    benefits: asStringArray(record.benefits),
    workplace_name: asNullableString(record.workplace_name),
    company_logo_url: asNullableString(record.company_logo_url),
    overlay_text_color: asNullableString(record.overlay_text_color),
  };
}

function normalizeSavedJobEntry<T extends SavedJob | SkippedJob>(input: unknown): T | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const record = input as Record<string, unknown>;
  const id = asRequiredString(record.id);
  const jobId = asRequiredString(record.job_id);
  const createdAt = asRequiredString(record.created_at);

  if (!id || !jobId || !createdAt) return null;

  return {
    id,
    job_id: jobId,
    created_at: createdAt,
    job_postings: normalizeJobPostingShape(record.job_postings),
  } as T;
}

function sanitizeSavedJobsList<T extends SavedJob | SkippedJob>(input: unknown): T[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeSavedJobEntry<T>(item))
    .filter((item): item is T => item !== null);
}

function readCache<T extends SavedJob | SkippedJob>(key: string, userId: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env: CacheEnvelope<T> = JSON.parse(raw);
    if (!env || env.userId !== userId) return null;
    if (!Array.isArray(env.items)) {
      // Korrupt eller gammalt cacheformat — rensa så vi inte kraschar igen
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    const sanitizedItems = sanitizeSavedJobsList<T>(env.items);
    if (sanitizedItems.length !== env.items.length) {
      if (sanitizedItems.length === 0 && env.items.length > 0) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
        return null;
      }
      writeCache(key, userId, sanitizedItems);
    }
    return sanitizedItems;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
}

function writeCache<T>(key: string, userId: string, items: T[]): void {
  try {
    const env: CacheEnvelope<T> = {
      items: items.slice(0, 100),
      userId,
      timestamp: Date.now(),
    };
    safeSetItem(key, JSON.stringify(env));
  } catch {
    // ignore
  }
}

// 📚 PostgREST returnerar max 1000 rader per anrop. Användare med tusentals
// sparade/skippade jobb skulle annars tappa rader tyst. Vi hämtar i block om
// 1000 upp till ett tak (skyddar minnet på klienten).
const FETCH_CHUNK = 1000;
const FETCH_MAX_ROWS = 20000;

async function fetchAllRows(
  fetchRange: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let from = 0; from < FETCH_MAX_ROWS; from += FETCH_CHUNK) {
    const { data, error } = await fetchRange(from, from + FETCH_CHUNK - 1);
    if (error) throw new Error(error.message);
    const batch = Array.isArray(data) ? data : [];
    all.push(...batch);
    if (batch.length < FETCH_CHUNK) break;
  }
  return all;
}



const SAVED_SELECT = `
  id,
  job_id,
  created_at,
  job_postings (
    id,
    title,
    image_focus_position,
    location,
    workplace_city,
    workplace_county,
    employment_type,
    job_image_url,
    job_image_desktop_url,
    is_active,
    created_at,
    expires_at,
    applications_count,
    views_count,
    positions_count,
    salary_min,
    salary_max,
    salary_type,
    salary_transparency,
    benefits,
    workplace_name,
    company_logo_url,
    overlay_text_color
  )
`;

export function useSavedJobsCache(opts?: { enableSkipped?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enableSkipped = opts?.enableSkipped ?? false;

  // ── Saved jobs query ──
  const {
    data: savedJobs = [],
    isLoading: queryLoadingSaved,
  } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: async (): Promise<SavedJob[]> => {
      if (!user) return [];
      const rows = await fetchAllRows((from, to) =>
        supabase
          .from('saved_jobs')
          .select(SAVED_SELECT)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to),
      );
      const items = sanitizeSavedJobsList<SavedJob>(rows);
      writeCache<SavedJob>(SAVED_CACHE_KEY, user.id, items);
      return items;
    },

    enabled: !!user,
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    structuralSharing: false,
    placeholderData: () => {
      if (!user) return undefined;
      return readCache<SavedJob>(SAVED_CACHE_KEY, user.id) ?? undefined;
    },
  });

  const safeSavedJobs = useMemo(() => sanitizeSavedJobsList<SavedJob>(savedJobs), [savedJobs]);
  const isLoadingSaved = queryLoadingSaved && safeSavedJobs.length === 0;

  // ── Skipped jobs query (lazy: only when tab opened) ──
  const {
    data: skippedJobs = [],
    isLoading: queryLoadingSkipped,
  } = useQuery({
    queryKey: ['skipped-jobs', user?.id],
    queryFn: async (): Promise<SkippedJob[]> => {
      if (!user) return [];
      const rows = await fetchAllRows((from, to) =>
        supabase
          .from('swipe_actions')
          .select(SAVED_SELECT)
          .eq('user_id', user.id)
          .eq('action', 'skipped')
          .order('created_at', { ascending: false })
          .range(from, to),
      );
      const items = sanitizeSavedJobsList<SkippedJob>(rows);

      writeCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id, items);
      return items;
    },
    enabled: !!user && enableSkipped,
    staleTime: 60_000,
    gcTime: Infinity,
    // 🔁 Refetcha alltid vid mount om data är stale. Utan detta visas gammal
    // placeholderData (0 items) för alltid, även efter att användaren swipat
    // bort nya jobb i Swipe Mode.
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    structuralSharing: false,
    placeholderData: () => {
      if (!user) return undefined;
      return readCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id) ?? undefined;
    },
  });

  const safeSkippedJobs = useMemo(() => sanitizeSavedJobsList<SkippedJob>(skippedJobs), [skippedJobs]);
  const isLoadingSkipped = enableSkipped && queryLoadingSkipped && safeSkippedJobs.length === 0;
  const savedJobIds = useMemo(() => new Set(safeSavedJobs.map((job) => job.job_id)), [safeSavedJobs]);

  // ── Realtime: job_postings updates for saved jobs only ──
  useEffect(() => {
    if (!user?.id || safeSavedJobs.length === 0) return;
    const ids = new Set(safeSavedJobs.map(sj => sj.job_id));

    // 📡 Skal-skydd: prenumerera bara på uppdateringar för användarens egna
    // sparade jobb. Utan server-side filter skulle VARJE job_postings-uppdatering
    // i hela systemet (t.ex. applications_count vid varje ansökan) pushas till
    // varje klient som har sidan öppen. Över 100 id:n (extremfall) faller vi
    // tillbaka på ofiltrerad kanal + klientfiltrering.
    const idList = Array.from(ids);
    const serverFilter = idList.length <= 100 ? `id=in.(${idList.join(',')})` : undefined;

    const channel = createRealtimeChannel(`saved-jobs-postings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_postings',
          ...(serverFilter ? { filter: serverFilter } : {}),
        },
        (payload) => {
          if (!ids.has(payload.new.id)) return;
          queryClient.setQueryData(['saved-jobs', user.id], (oldData: SavedJob[] | undefined) => {
            if (!oldData) return oldData;
            const current = sanitizeSavedJobsList<SavedJob>(oldData);
            let changed = false;
            const next = current.map(sj => {
              if (!sj.job_postings || sj.job_postings.id !== payload.new.id) return sj;
              const jp = sj.job_postings;
              if (
                jp.applications_count === payload.new.applications_count &&
                jp.workplace_name === payload.new.workplace_name &&
                jp.company_logo_url === payload.new.company_logo_url &&
                jp.is_active === payload.new.is_active &&
                jp.expires_at === payload.new.expires_at
              ) {
                return sj;
              }
              changed = true;
              return {
                ...sj,
                job_postings: {
                  ...jp,
                  applications_count: payload.new.applications_count,
                  workplace_name: payload.new.workplace_name,
                  company_logo_url: payload.new.company_logo_url,
                  is_active: payload.new.is_active,
                  expires_at: payload.new.expires_at,
                },
              };
            });
            return changed ? next : current;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, safeSavedJobs, queryClient]);

  // ── Optimistic remove (used when user confirms unsave) ──
  const removeSavedJobLocally = useCallback((jobId: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(['saved-jobs', user.id], (old: SavedJob[] | undefined) => {
      const current = sanitizeSavedJobsList<SavedJob>(old);
      const next = current.filter(sj => sj.job_id !== jobId);
      if (next) writeCache<SavedJob>(SAVED_CACHE_KEY, user.id, next);
      return next;
    });
  }, [user?.id, queryClient]);

  // ── Optimistic remove for skipped tab ──
  const removeSkippedJobLocally = useCallback((jobId: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(['skipped-jobs', user.id], (old: SkippedJob[] | undefined) => {
      const current = sanitizeSavedJobsList<SkippedJob>(old);
      const next = current.filter(sj => sj.job_id !== jobId);
      if (next) writeCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id, next);
      return next;
    });
  }, [user?.id, queryClient]);

  // 🔔 Jobbet skippades i Swipe Mode → DB-triggern har redan tagit bort
  // sparningen. Spegla det direkt så Sparade-listan aldrig visar ett jobb
  // som inte längre är sparat i databasen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const jobId = (e as CustomEvent<{ jobId: string }>).detail?.jobId;
      if (jobId) removeSavedJobLocally(jobId);
    };
    window.addEventListener('parium:job-unsaved', handler);
    return () => window.removeEventListener('parium:job-unsaved', handler);
  }, [removeSavedJobLocally]);

  const { isPremium } = useIsPremium();

  const toggleSavedJob = useCallback(async (jobId: string, jobPosting?: JobPostingInput) => {
    if (!user?.id) return;

    const wasSaved = savedJobIds.has(jobId);

    // 🔒 Premium-gate: max 3 sparade jobb samtidigt på gratisplan.
    if (!wasSaved && !isPremium && savedJobIds.size >= SAVED_JOBS_FREE_LIMIT) {
      emitSavedJobsLimit({ limit: SAVED_JOBS_FREE_LIMIT });
      return;
    }

    queryClient.setQueryData(['saved-jobs', user.id], (old: SavedJob[] | undefined) => {
      const current = sanitizeSavedJobsList<SavedJob>(old);

      if (wasSaved) {
        const next = current.filter((job) => job.job_id !== jobId);
        writeCache<SavedJob>(SAVED_CACHE_KEY, user.id, next);
        return next;
      }

      if (!jobPosting) return current;

      const optimisticJob: SavedJob = {
        id: `optimistic-${jobId}`,
        job_id: jobId,
        created_at: new Date().toISOString(),
        job_postings: jobPosting,
      };

      const next = [optimisticJob, ...current.filter((job) => job.job_id !== jobId)];
      writeCache<SavedJob>(SAVED_CACHE_KEY, user.id, next);
      return next;
    });

    // 🔗 Ett jobb kan aldrig vara både sparat och skippat — DB-triggern
    // enforce_saved_skipped_exclusivity rensar skip-raden, spegla det optimistiskt.
    if (!wasSaved) {
      removeSkippedJobLocally(jobId);
    }

    try {
      if (wasSaved) {
        const { error } = await supabase
          .from('saved_jobs')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('saved_jobs')
        .insert({ user_id: user.id, job_id: jobId });

      if (error && error.code !== '23505') throw error;

      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user.id] });
      // Triggern tog bort ev. skip-rad → håll skippade-listan och swipe-kön i synk
      queryClient.invalidateQueries({ queryKey: ['skipped-jobs', user.id] });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('parium:swipe-action-removed', { detail: { jobId } }),
        );
      }
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user.id] });
      queryClient.invalidateQueries({ queryKey: ['skipped-jobs', user.id] });
      throw error;
    }
  }, [user?.id, queryClient, savedJobIds, isPremium, removeSkippedJobLocally]);

  /**
   * 🗑️ Massrensning — tar bort flera sparade jobb i en och samma runda.
   * Chunkat i grupper om 200 id:n så URL:en aldrig blir för lång även om
   * användaren markerar tiotusentals rader.
   */
  const bulkRemoveSaved = useCallback(async (jobIds: string[]) => {
    if (!user?.id || jobIds.length === 0) return;
    const ids = Array.from(new Set(jobIds));

    queryClient.setQueryData(['saved-jobs', user.id], (old: SavedJob[] | undefined) => {
      const current = sanitizeSavedJobsList<SavedJob>(old);
      const removal = new Set(ids);
      const next = current.filter((sj) => !removal.has(sj.job_id));
      writeCache<SavedJob>(SAVED_CACHE_KEY, user.id, next);
      return next;
    });

    try {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase
          .from('saved_jobs')
          .delete()
          .eq('user_id', user.id)
          .in('job_id', chunk);
        if (error) throw error;
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user.id] });
    }
  }, [user?.id, queryClient]);

  /** 🗑️ Massrensning av skippade jobb (swipe_actions, action='skipped'). */
  const bulkRemoveSkipped = useCallback(async (jobIds: string[]) => {
    if (!user?.id || jobIds.length === 0) return;
    const ids = Array.from(new Set(jobIds));

    queryClient.setQueryData(['skipped-jobs', user.id], (old: SkippedJob[] | undefined) => {
      const current = sanitizeSavedJobsList<SkippedJob>(old);
      const removal = new Set(ids);
      const next = current.filter((sj) => !removal.has(sj.job_id));
      writeCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id, next);
      return next;
    });

    try {
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { error } = await supabase
          .from('swipe_actions')
          .delete()
          .eq('user_id', user.id)
          .eq('action', 'skipped')
          .in('job_id', chunk);
        if (error) throw error;
      }
      // Jobben återgår till swipe-kön — meddela öppna vyer.
      if (typeof window !== 'undefined') {
        for (const jobId of ids) {
          window.dispatchEvent(
            new CustomEvent('parium:swipe-action-removed', { detail: { jobId } }),
          );
        }
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: ['skipped-jobs', user.id] });
    }
  }, [user?.id, queryClient]);

  const restoreSkippedJob = useCallback(async (jobId: string) => {
    if (!user?.id) return;

    removeSkippedJobLocally(jobId);

    try {
      const { error } = await supabase
        .from('swipe_actions')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', jobId)
        .eq('action', 'skipped');

      if (error) throw error;

      // 🔔 Broadcasta till alla useSwipeActions-instanser (t.ex. Swipe Mode)
      // så jobbet omedelbart återkommer i swipe-kön utan att sidan behöver
      // laddas om. Utan detta stannar den gamla `skippedJobIds`-Mapen kvar
      // och filtrerar bort jobbet lokalt tills nästa full reload.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('parium:swipe-action-removed', { detail: { jobId } }),
        );
      }
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['skipped-jobs', user.id] });
      throw error;
    }
  }, [user?.id, queryClient, removeSkippedJobLocally]);

  return {
    savedJobs: safeSavedJobs,
    savedJobIds,
    skippedJobs: safeSkippedJobs,
    isLoadingSaved,
    isLoadingSkipped,
    removeSavedJobLocally,
    removeSkippedJobLocally,
    toggleSavedJob,
    restoreSkippedJob,
    bulkRemoveSaved,
    bulkRemoveSkipped,
  };
}
