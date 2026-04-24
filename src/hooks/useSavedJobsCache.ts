import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { safeSetItem } from '@/lib/safeStorage';

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

function readCache<T>(key: string, userId: string): T[] | null {
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
    company_logo_url
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
      const { data, error } = await supabase
        .from('saved_jobs')
        .select(SAVED_SELECT)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data as unknown as SavedJob[]) || [];
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

  const safeSavedJobs = Array.isArray(savedJobs) ? savedJobs : [];
  const isLoadingSaved = queryLoadingSaved && safeSavedJobs.length === 0;

  // ── Skipped jobs query (lazy: only when tab opened) ──
  const {
    data: skippedJobs = [],
    isLoading: queryLoadingSkipped,
  } = useQuery({
    queryKey: ['skipped-jobs', user?.id],
    queryFn: async (): Promise<SkippedJob[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('swipe_actions')
        .select(SAVED_SELECT)
        .eq('user_id', user.id)
        .eq('action', 'skipped')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data as unknown as SkippedJob[]) || [];
      writeCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id, items);
      return items;
    },
    enabled: !!user && enableSkipped,
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    structuralSharing: false,
    placeholderData: () => {
      if (!user) return undefined;
      return readCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id) ?? undefined;
    },
  });

  const safeSkippedJobs = Array.isArray(skippedJobs) ? skippedJobs : [];
  const isLoadingSkipped = enableSkipped && queryLoadingSkipped && safeSkippedJobs.length === 0;
  const savedJobIds = useMemo(() => new Set(safeSavedJobs.map((job) => job.job_id)), [safeSavedJobs]);

  // ── Realtime: job_postings updates for saved jobs only ──
  useEffect(() => {
    if (!user?.id || !Array.isArray(savedJobs) || savedJobs.length === 0) return;
    const ids = new Set(savedJobs.map(sj => sj.job_id));

    const channel = supabase
      .channel(`saved-jobs-postings-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_postings' },
        (payload) => {
          if (!ids.has(payload.new.id)) return;
          queryClient.setQueryData(['saved-jobs', user.id], (oldData: SavedJob[] | undefined) => {
            if (!oldData) return oldData;
            let changed = false;
            const next = oldData.map(sj => {
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
            return changed ? next : oldData;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, savedJobs, queryClient]);

  // ── Optimistic remove (used when user confirms unsave) ──
  const removeSavedJobLocally = useCallback((jobId: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(['saved-jobs', user.id], (old: SavedJob[] | undefined) => {
      const next = old ? old.filter(sj => sj.job_id !== jobId) : old;
      if (next) writeCache<SavedJob>(SAVED_CACHE_KEY, user.id, next);
      return next;
    });
  }, [user?.id, queryClient]);

  // ── Optimistic remove for skipped tab ──
  const removeSkippedJobLocally = useCallback((jobId: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(['skipped-jobs', user.id], (old: SkippedJob[] | undefined) => {
      const next = old ? old.filter(sj => sj.job_id !== jobId) : old;
      if (next) writeCache<SkippedJob>(SKIPPED_CACHE_KEY, user.id, next);
      return next;
    });
  }, [user?.id, queryClient]);

  const toggleSavedJob = useCallback(async (jobId: string, jobPosting?: JobPostingInput) => {
    if (!user?.id) return;

    const wasSaved = savedJobIds.has(jobId);

    queryClient.setQueryData(['saved-jobs', user.id], (old: SavedJob[] | undefined) => {
      const current = old ?? [];

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
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user.id] });
      throw error;
    }
  }, [user?.id, queryClient, savedJobIds]);

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
  };
}
