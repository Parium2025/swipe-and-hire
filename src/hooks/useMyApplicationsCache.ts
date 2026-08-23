import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useCallback, useRef } from 'react';
import { imageCache } from '@/lib/imageCache';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { getIsOnline } from '@/lib/connectivityManager';
import { enqueueHide, dequeueHide, pushHide, getQueuedHiddenIds } from '@/lib/applicationHideQueue';


import {
  MY_APPLICATIONS_SELECT,
  type MyApplication as Application,
} from './myApplicationsShared';

export type { MyApplication, MyApplicationsJobPosting } from './myApplicationsShared';

// LocalStorage cache for instant load - no expiry, background sync keeps fresh
const CACHE_KEY = 'parium_my_applications_cache_v2';

// Clear old cache key on load
try { localStorage.removeItem('parium_my_applications_cache'); } catch { /* ignore */ }

/** Clear the localStorage cache so next mount fetches fresh data */
export function clearMyApplicationsLocalCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

interface CachedData {
  applications: Application[];
  userId: string;
  timestamp: number;
}

function readCache(userId: string): Application[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (!cached || cached.userId !== userId) return null;
    if (!Array.isArray(cached.applications)) {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return null;
    }
    return cached.applications;
  } catch {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function writeCache(userId: string, applications: Application[]): void {
  try {
    const cached: CachedData = {
      applications: applications.slice(0, 50), // Max 50 items to save space
      userId,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

// Debounced writer — realtime can trigger many refetches per minute;
// batching localStorage writes to at most once per 2s keeps main thread free.
let writeCacheTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCacheWrite: { userId: string; applications: Application[] } | null = null;
function writeCacheDebounced(userId: string, applications: Application[]): void {
  pendingCacheWrite = { userId, applications };
  if (writeCacheTimer) return;
  writeCacheTimer = setTimeout(() => {
    writeCacheTimer = null;
    if (pendingCacheWrite) {
      writeCache(pendingCacheWrite.userId, pendingCacheWrite.applications);
      pendingCacheWrite = null;
    }
  }, 2000);
}

/**
 * Hook to fetch job seeker's applications with instant load from localStorage
 * and real-time background sync.
 */
export function useMyApplicationsCache() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      localStorage.removeItem('job_seeker_applications_' + (user?.id || ''));
    } catch {
      // ignore legacy cache cleanup errors
    }
  }, [user?.id]);


  const { data: applications = [], isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ['my-applications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Paginerat — utan detta kapades listan tyst vid 1000 ansökningar.
      const apps = (await fetchAllPages<any>((from, to) =>
        supabase
          .from('job_applications')
          .select(MY_APPLICATIONS_SELECT)
          .eq('applicant_id', user.id)
          .order('applied_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      )) as Application[];


      // Debounced write to localStorage (batches bursts from realtime)
      writeCacheDebounced(user.id, apps);

      return apps;
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // 5 minutes — prevents stale data persisting forever
    refetchOnMount: 'always', // Always refetch when component mounts
    structuralSharing: false, // Ensure new data triggers re-render
    placeholderData: () => {
      if (!user) return undefined;
      return readCache(user.id) ?? undefined;
    },
  });

  // Only show loading if we have no data at all (no placeholder, no fetched data)
  const isLoading = queryLoading && applications.length === 0;

  // 🖼️ Preload job images (mobile + desktop variants) into the blob cache
  // as soon as data is available. Guarantees both tabs — "Under granskning"
  // AND "Utgångna" — render instantly, no blink when switching tabs.
  // Deduped per URL by imageCache; only newly-seen URLs actually fetch.
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!applications.length) return;
    const urls: string[] = [];
    for (const app of applications) {
      const job = app.job_postings;
      if (!job) continue;
      if (job.job_image_url && !preloadedUrlsRef.current.has(job.job_image_url)) {
        preloadedUrlsRef.current.add(job.job_image_url);
        urls.push(job.job_image_url);
      }
      if (job.job_image_desktop_url && !preloadedUrlsRef.current.has(job.job_image_desktop_url)) {
        preloadedUrlsRef.current.add(job.job_image_desktop_url);
        urls.push(job.job_image_desktop_url);
      }
      if (job.company_logo_url && !preloadedUrlsRef.current.has(job.company_logo_url)) {
        preloadedUrlsRef.current.add(job.company_logo_url);
        urls.push(job.company_logo_url);
      }
    }
    if (urls.length === 0) return;
    // Defer to idle so it never competes with animations/scrolling
    const run = () => { void imageCache.preloadImages(urls); };
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(run, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 100);
    return () => clearTimeout(id);
  }, [applications]);

  // Real-time subscription for application updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-applications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Real-time subscription for job posting updates (applications_count,
  // deleted_at, expires_at, image fields, etc.).
  // Subscribed ONCE per user — no `applications.length` in deps, otherwise
  // the channel tears down and re-subscribes on every application change,
  // which is expensive on Realtime quota and causes brief update gaps.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-applications-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_postings',
        },
        (payload) => {
          // Merge full row from realtime payload — spreading payload.new
          // guarantees we never miss a field (payload.new contains ALL columns).
          queryClient.setQueryData(['my-applications', user.id], (oldData: Application[] | undefined) => {
            if (!oldData || oldData.length === 0) return oldData;
            const newRow = payload.new as { id: string } & Partial<NonNullable<Application['job_postings']>>;
            let changed = false;
            const next = oldData.map(application => {
              if (application.job_postings && application.job_postings.id === newRow.id) {
                changed = true;
                return {
                  ...application,
                  job_postings: {
                    ...application.job_postings,
                    ...newRow,
                  },
                };
              }
              return application;
            });
            return changed ? next : oldData;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);


  // Dölj ansökan (aldrig hard delete — arbetsgivaren behåller ansökan).
  // Offline: åtgärden köas och replayas när nätet är tillbaka.
  const hideApplication = useCallback(async (applicationId: string) => {
    if (!user) return;
    const hiddenAt = Date.now();

    // Optimistisk uppdatering
    queryClient.setQueryData(['my-applications', user.id], (old: Application[] | undefined) => {
      const updated = old?.filter(app => app.id !== applicationId) || [];
      writeCache(user.id, updated);
      return updated;
    });

    // Köa direkt — tas bort ur kön så fort servern bekräftat
    enqueueHide(applicationId, user.id);

    if (!getIsOnline()) {
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
      return;
    }

    const ok = await pushHide(applicationId, user.id, hiddenAt);
    if (ok) {
      dequeueHide(applicationId, user.id);
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
    } else {
      // Ligger kvar i kön och flushas av OfflineQueueRunner
      queryClient.invalidateQueries({ queryKey: ['my-applications-count'] });
    }
  }, [user, queryClient]);

  return {
    applications,
    isLoading,
    error,
    refetch,
    hideApplication,
    /** @deprecated Jobbsökare kan inte radera ansökningar — döljer endast i egen vy. */
    deleteApplication: hideApplication,
  };
}

