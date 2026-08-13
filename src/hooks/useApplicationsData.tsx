import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { safeSetItem, safeReadJsonCache } from '@/lib/safeStorage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { smartSearchCandidates } from '@/lib/smartSearch';
import { markViewedInSession } from '@/lib/viewedApplicationsSession';

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
  questions_snapshot?: any;
  job_title?: string;
  job_occupation?: string | null;
  profile_image_url?: string | null;
  video_url?: string | null;
  is_profile_video?: boolean | null;
  viewed_at?: string | null;
  last_active_at?: string | null;
  rating?: number | null;
  city?: string | null;
  /** Varför kandidaten matchade sökningen: profil, CV-text eller anteckning. */
  match_source?: 'profile' | 'cv' | 'note' | null;
  /** True när kandidatens konto har raderats — ansökan finns kvar som dokumentation. */
  account_deleted?: boolean;
}


const PAGE_SIZE = 25;
// Räknaren är exakt upp till denna gräns; däröver visar UI "10 000+".
// Att svepa hela träffmängden vid 100 000+ kandidater är inte försvarbart.
const COUNT_CAP = 10000;

/** Markör för nästa sida. Tidsbaserad sortering använder markören, övriga offset. */
interface PageParam {
  index: number;
  cursorAppliedAt: string | null;
  cursorId: string | null;
}
// Auto-prefetch bara de första 100 kandidaterna. Varje sida kostar 3 extra
// RPC-anrop (media, aktivitet, betyg) — vid 10 000+ kandidater blir 20 sidor ren
// bortkastad trafik. Resten laddas när användaren faktiskt scrollar.
const MAX_AUTO_PREFETCH_PAGES = 4;
const SNAPSHOT_KEY_PREFIX = 'applications_snapshot_';
const RATINGS_CACHE_PREFIX = 'ratings_cache_';
const SNAPSHOT_TTL_MS = 60 * 60 * 1000; // 1 hour — safety net; realtime keeps data fresh within TTL
const RATINGS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface SnapshotData {
  items: ApplicationData[];
  timestamp: number;
}

interface RatingsCacheData {
  ratings: Record<string, number>;
  timestamp: number;
}

// Read cached ratings from localStorage for instant display
// Använder safeReadJsonCache så korrupt/gammalt format aldrig kan krascha appen.
const readCachedRatings = (userId: string): Record<string, number> => {
  const key = RATINGS_CACHE_PREFIX + userId;
  const cache = safeReadJsonCache<RatingsCacheData>(
    key,
    (p): p is RatingsCacheData =>
      typeof p === 'object' && p !== null &&
      'ratings' in p && typeof (p as any).ratings === 'object' && (p as any).ratings !== null,
  );
  if (!cache) return {};
  // TTL check
  if (cache.timestamp && Date.now() - cache.timestamp > RATINGS_TTL_MS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return {};
  }
  return cache.ratings || {};
};

// Save ratings to localStorage cache
const writeCachedRatings = (userId: string, ratings: Record<string, number>) => {
  try {
    const key = RATINGS_CACHE_PREFIX + userId;
    const cache: RatingsCacheData = {
      ratings,
      timestamp: Date.now()
    };
    safeSetItem(key, JSON.stringify(cache));
  } catch {
    // localStorage full or not available
  }
};

// Read snapshot from localStorage - PRIORITIZE INSTANT DISPLAY
// We accept slightly stale data to show content immediately on login/refresh
// Now also merges cached ratings for instant rating display (no flicker)
// Använder safeReadJsonCache så korrupt format inte kraschar via .map/.filter.
// En kandidat = en rad (senaste ansökan vinner). Används både för snapshot och lista
// så att räknaren i rubriken alltid matchar antalet kort.
const dedupeByApplicant = (items: ApplicationData[]): ApplicationData[] => {
  const byApplicant = new Map<string, ApplicationData>();
  for (const app of items) {
    if (!app?.applicant_id) continue;
    const existing = byApplicant.get(app.applicant_id);
    if (!existing || (app.applied_at && (!existing.applied_at || app.applied_at > existing.applied_at))) {
      byApplicant.set(app.applicant_id, app);
    }
  }
  return Array.from(byApplicant.values());
};

const readSnapshot = (userId: string): ApplicationData[] => {

  const key = SNAPSHOT_KEY_PREFIX + userId;
  const snapshot = safeReadJsonCache<SnapshotData>(
    key,
    (p): p is SnapshotData =>
      typeof p === 'object' && p !== null &&
      'items' in p && Array.isArray((p as any).items),
  );
  if (!snapshot) return [];
  // TTL check — invalidate snapshots older than 1 hour as safety net
  if (snapshot.timestamp && Date.now() - snapshot.timestamp > SNAPSHOT_TTL_MS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return [];
  }
  try {

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

    // Minimal schema validation - only check essential fields (id, first_name)
    // More relaxed validation to ensure we show SOMETHING instantly
    // Background refresh will fill in missing data
    const first = snapshot.items?.[0] as any;
    const hasBasicFields = !first || ('id' in first && 'applicant_id' in first);

    if (!hasBasicFields) {
      localStorage.removeItem(key);
      return [];
    }

    // En kandidat = en rad. Äldre snapshots kan innehålla flera ansökningar per
    // person (före serversidig dedup) — då blev räknaren fel ("13" men 1 kort).
    const dedupedItems = dedupeByApplicant(snapshot.items || []);

    // CRITICAL: Merge cached ratings into snapshot items for instant rating display
    // This eliminates the "millisecond flicker" where ratings appear after the list
    const cachedRatings = readCachedRatings(userId);
    if (Object.keys(cachedRatings).length > 0) {
      return dedupedItems.map(item => ({
        ...item,
        rating: cachedRatings[item.applicant_id] ?? item.rating ?? null,
      }));
    }

    return dedupedItems;
  } catch {
    return [];
  }
};


// Write snapshot to localStorage
const writeSnapshot = (userId: string, items: ApplicationData[]) => {
  try {
    const key = SNAPSHOT_KEY_PREFIX + userId;
    const snapshot: SnapshotData = {
      items: dedupeByApplicant(items).slice(0, 50), // Max 50 unika kandidater
      timestamp: Date.now(),
    };
    safeSetItem(key, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Failed to write snapshot:', e);
  }
};

export interface QuestionFilterInput {
  question: string;
  answers: string[];
}

export interface ApplicationsDataOptions {
  /** Frågefilter — körs serversidigt så räknare stämmer även vid 10 000+ kandidater */
  questionFilters?: QuestionFilterInput[];
  /** Segment: 'all' | 'pending' | 'reviewing' | 'hired' | 'rejected' */
  statusFilter?: string;
  /** Sortering: 'applied_at' | 'oldest' | 'name' | 'rating' */
  sortBy?: string;
}

export const useApplicationsData = (
  searchQuery: string = '',
  options: ApplicationsDataOptions = {},
) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  

  const questionFilters = options.questionFilters ?? [];
  const statusFilter = options.statusFilter && options.statusFilter !== 'all' ? options.statusFilter : null;
  const sortBy = options.sortBy || 'applied_at';
  const isTimeSort = sortBy === 'applied_at' || sortBy === 'oldest';

  // Stabil nyckel så queryn inte refetchar på varje render
  const filtersKey = useMemo(() => JSON.stringify(questionFilters), [questionFilters]);
  // Ofiltrerad standardvy = den enda vy som får läsa/skriva localStorage-snapshoten
  const isDefaultView =
    !searchQuery.trim() && questionFilters.length === 0 && !statusFilter && sortBy === 'applied_at';

  const queryKey = useMemo(
    () => ['applications', user?.id, searchQuery, filtersKey, statusFilter, sortBy] as const,
    [user?.id, searchQuery, filtersKey, statusFilter, sortBy],
  );

  const {
    data,
    isLoading,
    isFetching,

    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,

    initialPageParam: { index: 0, cursorAppliedAt: null, cursorId: null } as PageParam,
    queryFn: async ({ pageParam }) => {
      const pp: PageParam =
        typeof pageParam === 'number'
          ? { index: pageParam, cursorAppliedAt: null, cursorId: null }
          : ((pageParam as PageParam) ?? { index: 0, cursorAppliedAt: null, cursorId: null });

      if (!user) {
        return { items: [], hasMore: false, totalCount: 0, totalCapped: false, nextCursor: null };
      }

      const from = pp.index * PAGE_SIZE;
      // Markörpaginering används för tidsbaserad sortering (standardvyn). Då är
      // sida 4 000 lika snabb som sida 1 — offset tvingar databasen att hoppa
      // över alla föregående rader varje gång.
      const useCursor = isTimeSort && !!pp.cursorAppliedAt && !!pp.cursorId;

      // Allt filtrerande (FTS + trigram-fuzzy + frågefilter + status + sortering)
      // körs i databasen. Kritiskt vid tiotusentals kandidater: annars filtrerar
      // vi bara de sidor som råkar vara nedladdade och räknaren blir fel.
      let baseData: any[] | null = null;
      let baseError: any = null;

      try {
        const result = await supabase.rpc('search_employer_candidates', {
          p_search: searchQuery?.trim() ? searchQuery.trim() : null,
          p_filters: questionFilters as any,
          p_status: statusFilter,
          p_sort: sortBy,
          p_limit: PAGE_SIZE,
          p_offset: useCursor ? 0 : from,
          // Räkna bara totalen på första sidan — vid 100 000+ kandidater
          // sparar det ett fullt svep per extra sida som scrollas in.
          p_with_count: pp.index === 0,
          p_cursor_applied_at: useCursor ? pp.cursorAppliedAt : null,
          p_cursor_id: useCursor ? pp.cursorId : null,
          p_count_cap: COUNT_CAP,
        } as any);
        baseData = result.data as any[] | null;
        baseError = result.error;
      } catch (networkError) {

        // OFFLINE FALLBACK: If network fails, use cached snapshot with client-side search
        if (!navigator.onLine) {
          const snapshot = readSnapshot(user.id);
          if (snapshot.length > 0) {
            console.log('📡 Offline: using cached snapshot for candidate search');
            const filtered = searchQuery?.trim()
              ? smartSearchCandidates(snapshot, searchQuery)
              : snapshot;
            return {
              items: filtered.slice(from, from + PAGE_SIZE),
              hasMore: filtered.length > from + PAGE_SIZE,
              totalCount: filtered.length,
              totalCapped: false,
              nextCursor: null,
            };
          }
        }
        throw networkError;
      }

      if (baseError) {
        console.error('❌ Applications query error:', baseError);
        // OFFLINE FALLBACK for FTS syntax errors or other DB errors
        if (!navigator.onLine) {
          const snapshot = readSnapshot(user.id);
          if (snapshot.length > 0) {
            const filtered = searchQuery?.trim()
              ? smartSearchCandidates(snapshot, searchQuery)
              : snapshot;
            return {
              items: filtered.slice(from, from + PAGE_SIZE),
              hasMore: filtered.length > from + PAGE_SIZE,
              totalCount: filtered.length,
              totalCapped: false,
              nextCursor: null,
            };
          }
        }
        throw baseError;
      }

      if (!baseData) {
        return { items: [], hasMore: false, totalCount: 0, totalCapped: false, nextCursor: null };
      }

      // total_count skickas bara med på första sidan (prestanda vid stora volymer).
      const rawTotal = baseData[0]?.total_count;
      const hasServerTotal = rawTotal !== null && rawTotal !== undefined;
      const rawTotalNum = hasServerTotal ? Number(rawTotal) : from + baseData.length;
      const totalCapped = hasServerTotal && rawTotalNum > COUNT_CAP;
      const totalCount = totalCapped ? COUNT_CAP : rawTotalNum;




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

       // Hämta aktuella betyg för dessa kandidater i en batch.
       const cachedRatings = readCachedRatings(user.id);
       const ratingsMap: Record<string, number> = { ...cachedRatings };

       const { data: ratingsData, error: ratingsError } = await supabase
         .from('candidate_ratings')
         .select('applicant_id, rating')
         .eq('recruiter_id', user.id)
         .in('applicant_id', applicantIds);

       if (!ratingsError && ratingsData) {
         // Databasen är sanningen: rensa cachade betyg för de kandidater vi
         // just frågade om, annars lever ett borttaget betyg kvar för alltid.
         applicantIds.forEach((id) => { delete ratingsMap[id]; });
         ratingsData.forEach((row: any) => {
           ratingsMap[row.applicant_id] = row.rating;
         });
         writeCachedRatings(user.id, ratingsMap);
       }


       // Transform data: RPC returnerar redan job_title/job_occupation/rating
       const items = baseData.map((item: any) => {
         const media =
           profileMediaMap[item.applicant_id] ||
           ({ profile_image_url: null, video_url: null, is_profile_video: null, last_active_at: null } as const);

         const activityLastActive = activityMap[item.applicant_id]?.last_active_at ?? null;
         const rating = ratingsMap[item.applicant_id] ?? item.rating ?? null;

         return {
           ...item,
           job_title: item.job_title || 'Okänt jobb',
           job_occupation: item.job_occupation || null,
           profile_image_url: media.profile_image_url,
           video_url: media.video_url,
           is_profile_video: media.is_profile_video,
           // Prefer activity RPC to stay 1:1 med "Mina kandidater"
           last_active_at: activityLastActive ?? media.last_active_at,
           viewed_at: item.viewed_at,
           rating,
           total_count: undefined,
         };
       }) as ApplicationData[];

      // Med markörpaginering är sidstorleken det enda tillförlitliga svaret på
      // om det finns mer — totalen är kapad och kan inte användas som gräns.
      const hasMore = baseData.length === PAGE_SIZE;
      const lastRow = baseData[baseData.length - 1];
      const nextCursor =
        isTimeSort && lastRow
          ? { cursorAppliedAt: lastRow.applied_at as string, cursorId: lastRow.id as string }
          : null;

      // Snapshot skrivs BARA för den ofiltrerade standardvyn — annars skulle
      // ett filtrerat urval återanvändas som "alla kandidater" nästa kalla start.
      if (pp.index === 0 && items.length > 0 && isDefaultView) {
        writeSnapshot(user.id, items);
      }

      // 🔥 Prefetch signed URLs + blob-cache för kandidatbilder i bakgrunden
      // Detta körs asynkront och blockerar inte returnering av data
      // Matcha CandidateAvatar (40px, 2x retina) så cache-key blir samma
      (async () => {
        const AVATAR_TRANSFORM = { width: 40, height: 40, resize: 'cover' as const };
        const storagePaths = items
          .map((i) => i.profile_image_url)
          .filter((p): p is string => typeof p === 'string' && p.trim() !== '');

        if (storagePaths.length === 0) return;

        // Begränsa för att undvika att spamma (samtidigt som /candidates känns instant)
        await Promise.all(
          storagePaths.slice(0, 25).map((p) => prefetchMediaUrl(p, 'profile-image', 86400, AVATAR_TRANSFORM).catch(() => {}))
        );
      })();

      return { items, hasMore, totalCount, totalCapped, nextCursor };
    },
    getNextPageParam: (lastPage: any, allPages: any[]): PageParam | undefined => {
      if (!lastPage?.hasMore) return undefined;
      return {
        index: allPages.length,
        cursorAppliedAt: lastPage.nextCursor?.cursorAppliedAt ?? null,
        cursorId: lastPage.nextCursor?.cursorId ?? null,
      };
    },
    enabled: !!user,
    // Behåll föregående resultat medan en ny sökning/filtrering hämtas.
    // Utan detta blir isLoading true vid varje ny sökbokstav → hela sidan
    // (inklusive sökfältet) byts mot skeleton och input tappar fokus.
    placeholderData: (previousData: any) => previousData,
    // Standardvyn cachas (realtime håller den fräsch). Sök/filter/sortering
    // måste alltid gå mot databasen.
    staleTime: isDefaultView ? Infinity : 0,
    gcTime: Infinity,
    refetchOnMount: !isDefaultView,
    refetchOnWindowFocus: false,
    initialData: () => {
      if (!user) return undefined;
      // Snapshot gäller bara den ofiltrerade standardvyn.
      if (!isDefaultView) return undefined;
      
      const snapshot = readSnapshot(user.id);
      if (snapshot.length === 0) return undefined;
      
      // Only show "load more" if snapshot is full page size
      const hasMore = snapshot.length >= PAGE_SIZE;
      
      return {
        pages: [{ items: snapshot, hasMore, totalCount: snapshot.length, totalCapped: false, nextCursor: null }],
        pageParams: [{ index: 0, cursorAppliedAt: null, cursorId: null } as PageParam],
      };
    },
  });


  // PRE-FETCHING: laddar nästa sidor i bakgrunden, men bara upp till en budget.
  // Utan budget skulle 10 000 kandidater ge 400 RPC-anrop direkt vid sidladdning.
  const [prefetchBudget, setPrefetchBudget] = useState(MAX_AUTO_PREFETCH_PAGES);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);

  useEffect(() => {
    const currentPageCount = data?.pages?.length || 0;

    if (currentPageCount >= prefetchBudget) {
      // Visa "fortsätt"-läget bara om det faktiskt finns mer att hämta
      setHasReachedLimit(!!hasNextPage);
      return;
    }

    setHasReachedLimit(false);

    if (hasNextPage && !isFetchingNextPage && currentPageCount > 0) {
      const timer = setTimeout(() => {
        fetchNextPage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data?.pages?.length, hasNextPage, isFetchingNextPage, fetchNextPage, prefetchBudget]);

  // Nollställ budgeten när sök/filter ändras — annars ligger "fortsätt"-läget kvar
  // från en tidigare sökning och nya träffar slutar ladda automatiskt.
  useEffect(() => {
    setPrefetchBudget(MAX_AUTO_PREFETCH_PAGES);
    setHasReachedLimit(false);
  }, [queryKey]);

  // Fortsätt ladda nästa batch (höjer budgeten istället för att bara hämta 1 sida)
  const continueLoading = useCallback(() => {
    setHasReachedLimit(false);
    setPrefetchBudget((prev) => (data?.pages?.length ?? prev) + MAX_AUTO_PREFETCH_PAGES);
    fetchNextPage();
  }, [fetchNextPage, data?.pages?.length]);


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
        queryClient.setQueryData(queryKey, (old: any) => {
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

    // 🔥 SCALED: Tidigare pollade vi var 60:e sekund, vilket gjorde 60 RPC-anrop/h
    // per arbetsgivare bara för "senast aktiv"-tider. Eftersom last_active_at i sin tur
    // bara uppdateras max var 5:e minut (useActivityTracker), var detta 12× mer trafik
    // än nödvändigt.
    //
    // Nu hämtas det:
    //  1. Direkt vid mount (void fetchLatestActivity ovan)
    //  2. När kandidat-set ändras (dep applicantIdsKey)
    //  3. När fönstret återfår fokus (visibilitychange) — viktigt för "kommer tillbaka"-fallet
    void fetchLatestActivity();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchLatestActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, applicantIdsKey, searchQuery, queryClient]);

  // Real-time subscription for job_applications changes
  // SCOPED to this employer's jobs via a dedicated channel per user to prevent
  // global broadcasts from triggering refetches for every employer on the platform
  // Cap at 50 job IDs for realtime filter — Supabase Realtime rejects overly long
  // filter strings. If employer has >50 jobs we subscribe without filter (broader
  // but still scoped by RLS, and the query invalidation is cheap).
  const MAX_REALTIME_FILTER_IDS = 50;
  const jobIdsForRealtime = useMemo(() => {
    return [...new Set(applications.map(a => a.job_id))].filter(Boolean).sort();
  }, [applications]);

  useEffect(() => {
    if (!user) return;
    if (jobIdsForRealtime.length === 0) return;

    const channelName = `applications-rt-${user.id}`;

    // Build filter config — skip filter entirely if too many IDs to avoid Supabase rejection
    const filterConfig: any = {
      event: '*',
      schema: 'public',
      table: 'job_applications',
    };

    if (jobIdsForRealtime.length === 1) {
      filterConfig.filter = `job_id=eq.${jobIdsForRealtime[0]}`;
    } else if (jobIdsForRealtime.length <= MAX_REALTIME_FILTER_IDS) {
      filterConfig.filter = `job_id=in.(${jobIdsForRealtime.join(',')})`;
    }
    // else: no filter — listen to all job_applications changes (RLS still protects data)

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', filterConfig, () => {
        queryClient.invalidateQueries({ queryKey: ['applications', user.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, jobIdsForRealtime]);

  // Real-time subscription för profilförändringar (bild, namn, video).
  // Triggar invalidate så listan visar senaste profilbild/namn när
  // en kandidat uppdaterar sin profil — utan att vänta på TTL eller manuell refresh.
  // Debouncas så en burst av uppdateringar bara triggar 1 refetch.
  const profilesInvalidateTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) return;
    if (applicantIdsKey.length === 0) return;

    const channelName = `applications-profiles-rt-${user.id}`;
    const applicantIds = applicantIdsKey.split('|').filter(Boolean);

    const filterConfig: any = {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
    };
    // Cap filter length — fall back till bred subscription om för många IDs (RLS skyddar).
    if (applicantIds.length === 1) {
      filterConfig.filter = `id=eq.${applicantIds[0]}`;
    } else if (applicantIds.length <= MAX_REALTIME_FILTER_IDS) {
      filterConfig.filter = `id=in.(${applicantIds.join(',')})`;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', filterConfig, () => {
        if (profilesInvalidateTimerRef.current) {
          window.clearTimeout(profilesInvalidateTimerRef.current);
        }
        profilesInvalidateTimerRef.current = window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['applications', user.id] });
        }, 400);
      })
      .subscribe();

    return () => {
      if (profilesInvalidateTimerRef.current) {
        window.clearTimeout(profilesInvalidateTimerRef.current);
        profilesInvalidateTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, applicantIdsKey]);

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
      queryClient.invalidateQueries({ queryKey });
    }
  }, [applications, user, queryKey, queryClient]);

  // (Borttaget) Extra hämtning av jobbtitlar — RPC:n returnerar redan job_title,
  // så den gamla effekten gjorde ett onödigt DB-anrop per laddad sida.


  // Sökningen filtreras helt i databasen (FTS + trigram + jobbtitel). Vi filtrerar
  // INTE om på klienten — det skulle bara kunna kasta bort giltiga serverträffar.
  const enrichedApplications = applications;


  // Deduplicate: one row per unique person, keeping the most recent application
  // Moved here from UI layer so all consumers get deduplicated data by default
  const deduplicatedApplications = useMemo(() => {
    const byApplicant = new Map<string, ApplicationData>();
    for (const app of enrichedApplications) {
      const existing = byApplicant.get(app.applicant_id);
      if (!existing || (app.applied_at && (!existing.applied_at || app.applied_at > existing.applied_at))) {
        byApplicant.set(app.applicant_id, app);
      }
    }
    return Array.from(byApplicant.values());
  }, [enrichedApplications]);

  // Memoize stats to prevent unnecessary recalculations
  const stats = useMemo(() => ({
    total: deduplicatedApplications.length,
    new: deduplicatedApplications.filter(app => app.status === 'pending').length,
    reviewing: deduplicatedApplications.filter(app => app.status === 'reviewing').length,
    hired: deduplicatedApplications.filter(app => app.status === 'hired').length,
    rejected: deduplicatedApplications.filter(app => app.status === 'rejected').length,
  }), [deduplicatedApplications]);

  const invalidateApplications = () => {
    queryClient.invalidateQueries({ queryKey: ['applications'] });
  };

  // Mark application as viewed
  const markAsViewed = useMutation({
    mutationFn: async (applicationId: string) => {
      // Session shadow — instant + survives any later refetch race
      markViewedInSession(applicationId);

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
      
      queryClient.setQueryData(queryKey, (old: any) => {
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

  // Update rating for a candidate - saves to persistent candidate_ratings table
  // AND updates localStorage cache for instant sync across views
  const updateRating = useMutation({
    mutationFn: async ({ applicantId, rating }: { applicantId: string; rating: number }) => {
      if (!user) throw new Error('Ej inloggad');

      // Upsert to candidate_ratings table
      const { error } = await supabase
        .from('candidate_ratings')
        .upsert({
          recruiter_id: user.id,
          applicant_id: applicantId,
          rating,
        }, {
          onConflict: 'recruiter_id,applicant_id',
        });

      if (error) throw error;

      // Update localStorage ratings cache for instant sync
      try {
        const cacheKey = `ratings_cache_${user.id}`;
        const parsed = safeReadJsonCache<{ ratings: Record<string, number>; timestamp: number }>(
          cacheKey,
          (p): p is { ratings: Record<string, number>; timestamp: number } =>
            typeof p === 'object' && p !== null &&
            'ratings' in p && typeof (p as any).ratings === 'object' && (p as any).ratings !== null,
        );
        const cache = parsed
          ? { ratings: parsed.ratings, timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now() }
          : { ratings: {} as Record<string, number>, timestamp: Date.now() };
        cache.ratings[applicantId] = rating;
        cache.timestamp = Date.now();
        safeSetItem(cacheKey, JSON.stringify(cache));
      } catch {
        // Ignore localStorage errors
      }

      return { applicantId, rating };
    },
    onMutate: async ({ applicantId, rating }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['applications', user?.id] });

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((app: ApplicationData) =>
              app.applicant_id === applicantId ? { ...app, rating } : app
            ),
          })),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
    },
  });

  return {
    applications: deduplicatedApplications,
    allApplications: enrichedApplications, // non-deduplicated, for consumers that need all
    stats,
    isLoading,
    isFetching,

    error,
    refetch,
    invalidateApplications,
    markAsViewed,
    updateRating,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Totalt antal träffar i databasen (inte bara laddade sidor)
    // När allt är laddat är listan sanningen — annars kan en gammal cache visa
    // fler "kandidater" i rubriken än det finns kort i listan.
    totalCount: hasNextPage
      ? Math.max(data?.pages?.[0]?.totalCount ?? 0, deduplicatedApplications.length)
      : deduplicatedApplications.length,
    // True när träffarna överstiger räknarens tak → UI visar "10 000+".
    totalCountCapped: Boolean((data?.pages?.[0] as any)?.totalCapped) && !!hasNextPage,

    // Nya för "Vill du fortsätta?" banner
    hasReachedLimit,
    continueLoading,
    loadedCount: data?.pages?.length ? data.pages.length * PAGE_SIZE : 0,
  };
};
