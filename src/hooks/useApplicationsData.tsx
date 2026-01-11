import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { smartSearchCandidates } from '@/lib/smartSearch';

export interface ApplicationData {
  id: string;
  job_id: string;
  applicant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  cv_url: string | null;
  age: number | null;
  employment_status: string | null;
  work_schedule: string | null;
  availability: string | null;
  status: string | null;
  applied_at: string;
  updated_at: string;
  custom_answers: any;
  job_title?: string;
  job_occupation?: string | null;
  profile_image_url?: string | null;
  video_url?: string | null;
  is_profile_video?: boolean | null;
  viewed_at?: string | null;
  last_active_at?: string | null;
}

const PAGE_SIZE = 25;
const SNAPSHOT_KEY_PREFIX = 'applications_snapshot_';
const SNAPSHOT_EXPIRY_MS = 5 * 60 * 1000; // 5 min

interface SnapshotData {
  items: ApplicationData[];
  timestamp: number;
}

// Read snapshot from localStorage
const readSnapshot = (userId: string): ApplicationData[] => {
  try {
    const key = SNAPSHOT_KEY_PREFIX + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const snapshot: SnapshotData = JSON.parse(raw);
    const age = Date.now() - snapshot.timestamp;

    if (age > SNAPSHOT_EXPIRY_MS) {
      localStorage.removeItem(key);
      return [];
    }


    // Invalidate snapshot if it contains legacy profile-media URLs (old format).
    // Those URLs are no longer a reliable source of truth; we only store storage paths.
    const hasLegacyProfileMediaUrls = (snapshot.items || []).some((item: any) => {
      const vals = [item?.profile_image_url, item?.video_url, item?.cv_url];
      return vals.some(
        (v) => typeof v === 'string' && v.includes('/storage/v1/object/') && v.includes('/profile-media/')
      );
    });

    if (hasLegacyProfileMediaUrls) {
      localStorage.removeItem(key);

      // Also clear any signed-url cache entries tied to legacy URLs so we don't reuse them.
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (!k.startsWith('media_url_')) continue;

          if (k.includes('profile-media')) {
            keysToRemove.push(k);
            continue;
          }

          const v = localStorage.getItem(k);
          if (v && v.includes('profile-media')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }

      return [];
    }

    // If schema changed (old snapshot missing fields), ignore it.
    // Must include profile_image_url field to show candidate avatars correctly
    // Also invalidate if profile media fields exist but are not properly set
    const first = snapshot.items?.[0] as any;

    // Check that all required fields exist
    const hasRequiredFields =
      !first ||
      ('age' in first &&
        'employment_status' in first &&
        'work_schedule' in first &&
        'availability' in first &&
        'cv_url' in first &&
        'profile_image_url' in first &&
        'video_url' in first &&
        'is_profile_video' in first &&
        'last_active_at' in first);

    if (!hasRequiredFields) {
      localStorage.removeItem(key);
      return [];
    }

    // CRITICAL: Invalidate snapshots where last_active_at exists but is null for ALL candidates
    // This ensures fresh data is fetched instead of showing stale "-" in "Senaste aktivitet"
    const allCandidatesLackLastActive = snapshot.items.every(
      (item: any) => item.last_active_at === null || item.last_active_at === undefined
    );
    if (allCandidatesLackLastActive && snapshot.items.length > 0) {
      localStorage.removeItem(key);
      return [];
    }

    const isValid = hasRequiredFields;

    if (!isValid) {
      localStorage.removeItem(key);
      return [];
    }

    return snapshot.items;
  } catch {
    return [];
  }
};

// Write snapshot to localStorage
const writeSnapshot = (userId: string, items: ApplicationData[]) => {
  try {
    const key = SNAPSHOT_KEY_PREFIX + userId;
    const snapshot: SnapshotData = {
      items: items.slice(0, 50), // Max 50 items
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Failed to write snapshot:', e);
  }
};

export const useApplicationsData = (searchQuery: string = '') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['applications', user?.id, searchQuery],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!user) {
        return { items: [], hasMore: false };
      }
      
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Build query with job title + occupation - profile image fetched via RPC for security
      let query = supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          applicant_id,
          first_name,
          last_name,
          email,
          phone,
          location,
          bio,
          cv_url,
          age,
          employment_status,
          work_schedule,
          availability,
          custom_answers,
          status,
          applied_at,
          updated_at,
          viewed_at,
          job_postings!inner(title, occupation)
        `);

      // Apply Full-Text Search for blazing fast filtering on 100k+ candidates
      // Uses GIN-indexed tsvector column - 10-100x faster than ILIKE on large datasets
      if (searchQuery && searchQuery.trim()) {
        const searchTerm = searchQuery.trim();
        
        // Convert search term to tsquery format (prefix matching for partial words)
        // "Joh" becomes "Joh:*" to match "Johan", "Johansson" etc
        const tsQueryTerm = searchTerm
          .split(/\s+/)
          .filter(Boolean)
          .map(word => `${word}:*`)
          .join(' & ');
        
        // Use Full-Text Search on the indexed search_vector column
        // Also search job title/occupation with ILIKE as fallback (they're in a joined table)
        query = query.or(`search_vector.fts.${tsQueryTerm},job_postings.title.ilike.%${searchTerm}%,job_postings.occupation.ilike.%${searchTerm}%`);
      }

      const { data: baseData, error: baseError } = await query
        .order('applied_at', { ascending: false })
        .range(from, to);

      if (baseError) {
        console.error('❌ Applications query error:', baseError);
        throw baseError;
      }

      if (!baseData) {
        return { items: [], hasMore: false };
      }


       // Fetch profile media (image, video, is_profile_video, last_active_at) via secure BATCH RPC function
       // This is a single call instead of N calls - critical for scalability with 10M+ users
       const applicantIds = [...new Set(baseData.map((item: any) => item.applicant_id))];
       const profileMediaMap: Record<
         string,
         {
           profile_image_url: string | null;
           video_url: string | null;
           is_profile_video: boolean | null;
           last_active_at: string | null;
         }
       > = {};

       // Single batch RPC call for all applicants (scales to millions)
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
             last_active_at: row.last_active_at || null,
           };
         });
       }

       // Fill in nulls for any applicants not returned (no permission)
       applicantIds.forEach((id) => {
         if (!profileMediaMap[id]) {
           profileMediaMap[id] = {
             profile_image_url: null,
             video_url: null,
             is_profile_video: null,
             last_active_at: null,
           };
         }
       });

       // Fetch latest activity (SAME source as "Mina kandidater") in one batch
       const activityMap: Record<string, { last_active_at: string | null }> = {};
       const { data: activityData } = await supabase.rpc('get_applicant_latest_activity', {
         p_applicant_ids: applicantIds,
         p_employer_id: user.id,
       });

       if (activityData) {
         activityData.forEach((row: any) => {
           activityMap[row.applicant_id] = { last_active_at: row.last_active_at ?? null };
         });
       }

       // Transform data to flatten job_postings and add profile media + last_active_at
       const items = baseData.map((item: any) => {
         const media =
           profileMediaMap[item.applicant_id] ||
           ({ profile_image_url: null, video_url: null, is_profile_video: null, last_active_at: null } as const);

         const activityLastActive = activityMap[item.applicant_id]?.last_active_at ?? null;

         return {
           ...item,
           job_title: item.job_postings?.title || 'Okänt jobb',
           job_occupation: item.job_postings?.occupation || null,
           profile_image_url: media.profile_image_url,
           video_url: media.video_url,
           is_profile_video: media.is_profile_video,
           // Prefer activity RPC to stay 1:1 with "Mina kandidater"
           last_active_at: activityLastActive ?? media.last_active_at,
           viewed_at: item.viewed_at,
           job_postings: undefined,
         };
       }) as ApplicationData[];

      const hasMore = items.length === PAGE_SIZE;

      // Write snapshot on first page
      if (pageParam === 0 && items.length > 0) {
        writeSnapshot(user.id, items);
      }

      // 🔥 Prefetch signed URLs + blob-cache för kandidatbilder i bakgrunden
      // Detta körs asynkront och blockerar inte returnering av data
      (async () => {
        const storagePaths = items
          .map((i) => i.profile_image_url)
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '');

        if (storagePaths.length === 0) return;

        // Begränsa för att undvika att spamma (samtidigt som /candidates känns instant)
        await Promise.all(
          storagePaths.slice(0, 25).map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {}))
        );
      })();

      return { items, hasMore };
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!user,
    staleTime: 0, // Always refetch for fresh data - background loading ensures instant display
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    initialData: () => {
      if (!user) return undefined;
      
      const snapshot = readSnapshot(user.id);
      if (snapshot.length === 0) return undefined;
      
      // Only show "load more" if snapshot is full page size
      const hasMore = snapshot.length >= PAGE_SIZE;
      
      return {
        pages: [{ items: snapshot, hasMore }],
        pageParams: [0],
      };
    },
  });

  // PRE-FETCHING: Automatically load next batch in background after each page loads
  // This makes scrolling feel instant - data is ready before user reaches bottom
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && data?.pages && data.pages.length > 0) {
      // Small delay to avoid blocking the main thread
      const timer = setTimeout(() => {
        fetchNextPage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data?.pages?.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages
  const applications = data?.pages.flatMap(page => page.items) || [];

  // Håll "Senaste aktivitet" synkad med exakt samma källa som i "Mina kandidater"
  // (viktigt när listan initialt kommer från localStorage-snapshot och queryn inte refetchar direkt)
  const lastActiveRefreshStateRef = useRef<{ key: string; lastAt: number; inFlight: boolean }>({
    key: '',
    lastAt: 0,
    inFlight: false,
  });

  const applicantIdsKey = useMemo(() => {
    const ids = [...new Set(applications.map((a) => a.applicant_id))].filter(Boolean) as string[];
    ids.sort();
    return ids.join('|');
  }, [applications]);

  useEffect(() => {
    if (!user) return;
    if (!applicantIdsKey) return;

    const applicantIds = applicantIdsKey.split('|').filter(Boolean);

    const fetchLatestActivity = async () => {
      const state = lastActiveRefreshStateRef.current;
      if (state.inFlight) return;

      const now = Date.now();
      // Max 1 gång/minut per identisk kandidat-set (och alltid första gången)
      if (state.key === applicantIdsKey && now - state.lastAt < 60_000) return;

      state.inFlight = true;
      try {
        const { data: activityData, error } = await supabase.rpc('get_applicant_latest_activity', {
          p_applicant_ids: applicantIds,
          p_employer_id: user.id,
        });

        if (error || !activityData) return;

        const activityMap = new Map<string, string | null>();
        (activityData as any[]).forEach((row) => {
          activityMap.set(row.applicant_id, row.last_active_at ?? null);
        });

        let updatedItems: ApplicationData[] | null = null;
        queryClient.setQueryData(['applications', user.id, searchQuery], (old: any) => {
          if (!old?.pages) return old;

          const pages = old.pages.map((page: any) => ({
            ...page,
            items: (page.items || []).map((app: ApplicationData) => {
              const next = activityMap.get(app.applicant_id);
              if (next === undefined) return app;
              if (app.last_active_at === next) return app;
              return { ...app, last_active_at: next };
            }),
          }));

          updatedItems = pages.flatMap((p: any) => p.items || []);
          return { ...old, pages };
        });

        state.key = applicantIdsKey;
        state.lastAt = Date.now();

        if (updatedItems && updatedItems.length > 0) {
          writeSnapshot(user.id, updatedItems);
        }
      } finally {
        lastActiveRefreshStateRef.current.inFlight = false;
      }
    };

    void fetchLatestActivity();
    const interval = window.setInterval(fetchLatestActivity, 60_000);
    return () => window.clearInterval(interval);
  }, [user, applicantIdsKey, searchQuery, queryClient]);

  // Real-time subscription for job_applications changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('applications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications'
        },
        (payload) => {
          // Invalidate queries to refetch with updated data
          queryClient.invalidateQueries({ queryKey: ['applications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Om vi råkar ha en gammal cache (prefetch utan media-fält) → tvinga refetch en gång.
  // Detta eliminerar behovet av manuell refresh för att avatar/video ska dyka upp.
  const fixedLegacyCacheRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (fixedLegacyCacheRef.current) return;
    if (applications.length === 0) return;

    const first: any = applications[0];
    const hasMediaFields =
      !first ||
      ('profile_image_url' in first && 'video_url' in first && 'is_profile_video' in first && 'last_active_at' in first);

    if (!hasMediaFields) {
      fixedLegacyCacheRef.current = true;
      queryClient.invalidateQueries({ queryKey: ['applications', user.id, searchQuery] });
    }
  }, [applications, user, searchQuery, queryClient]);

  // Enrich with additional job metadata if needed (kept for backwards compatibility)
  useEffect(() => {
    if (applications.length === 0) return;

    const uniqueJobIds = [...new Set(applications.map(app => app.job_id))];
    const missingIds = uniqueJobIds.filter(id => !jobTitles[id]);
    
    if (missingIds.length === 0) return;

    supabase
      .from('job_postings')
      .select('id, title')
      .in('id', missingIds)
      .then(({ data: jobData }) => {
        if (jobData) {
          const titleMap = Object.fromEntries(
            jobData.map(job => [job.id, job.title])
          );
          setJobTitles(prev => ({ ...prev, ...titleMap }));
        }
      });
  }, [applications, jobTitles]);

  // Apply client-side fuzzy matching for typo tolerance on top of FTS results
  // This runs on already-filtered data from the database, so it's fast
  const enrichedApplications = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) {
      return applications;
    }
    
    // FTS already filtered at database level - fuzzy matching adds typo tolerance
    // and re-ranks by relevance (best matches first)
    return smartSearchCandidates(applications, searchQuery);
  }, [applications, searchQuery]);

  // Memoize stats to prevent unnecessary recalculations
  const stats = useMemo(() => ({
    total: enrichedApplications.length,
    new: enrichedApplications.filter(app => app.status === 'pending').length,
    reviewing: enrichedApplications.filter(app => app.status === 'reviewing').length,
    hired: enrichedApplications.filter(app => app.status === 'hired').length,
    rejected: enrichedApplications.filter(app => app.status === 'rejected').length,
  }), [enrichedApplications]);

  const invalidateApplications = () => {
    queryClient.invalidateQueries({ queryKey: ['applications'] });
  };

  // Mark application as viewed
  const markAsViewed = useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('viewed_at', null);

      if (error) throw error;
    },
    onMutate: async (applicationId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['applications', user?.id] });
      
      queryClient.setQueryData(['applications', user?.id, searchQuery], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((app: ApplicationData) =>
              app.id === applicationId ? { ...app, viewed_at: new Date().toISOString() } : app
            ),
          })),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-candidates'] });
    },
  });

  return {
    applications: enrichedApplications,
    stats,
    isLoading,
    error,
    refetch,
    invalidateApplications,
    markAsViewed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
};
