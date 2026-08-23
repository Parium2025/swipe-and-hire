import { useState, useCallback, useMemo, useEffect, useRef, useId } from 'react';
import { safeReadJsonCache, safeSetItem } from '@/lib/safeStorage';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getActiveCandidateListId } from '@/lib/activeCandidateList';
import { toast } from 'sonner';
import { enqueueCandidateOperation, useCandidateOperationQueue } from '@/hooks/useCandidateOperationQueue';
import { getIsOnline } from '@/lib/connectivityManager';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { markViewedInSession } from '@/lib/viewedApplicationsSession';
import { syncProfileMediaVersions } from '@/lib/profileMediaVersions';
import { AVATAR_TRANSFORM, MEDIA_URL_TTL } from '@/lib/mediaPresets';
import { clampJobTitle } from '@/lib/jobTitle';
import { resolveCandidateMedia } from '@/lib/candidateMedia';
import { hydrateMyCandidateRows, type RawMyCandidateRow } from '@/lib/myCandidatesHydration';

// Stage can be a default stage or a custom stage key
export type CandidateStage = string;

export interface MyCandidateData {
  id: string;
  recruiter_id: string;
  applicant_id: string;
  application_id: string;
  job_id: string | null;
  stage: string; // Can be default stage or custom stage key
  notes: string | null;
  rating: number;
  created_at: string;
  updated_at: string;
  // Joined data from job_applications
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
  custom_answers: any | null;
  questions_snapshot?: any | null;
  status: string;
  job_title: string | null;
  profile_image_url: string | null;
  video_url: string | null;
  is_profile_video: boolean | null;
  applied_at: string | null;
  viewed_at: string | null;
  // Activity tracking - latest across organization
  latest_application_at: string | null;
  last_active_at: string | null;
}

export const STAGE_CONFIG = {
  to_contact: { label: 'Att kontakta', color: 'bg-blue-500/20 ring-1 ring-inset ring-blue-500/50 text-blue-100', hoverRing: 'ring-blue-500/70' },
  interview: { label: 'Intervju', color: 'bg-yellow-500/20 ring-1 ring-inset ring-yellow-500/50 text-yellow-100', hoverRing: 'ring-yellow-500/70' },
  offer: { label: 'Erbjudande', color: 'bg-purple-500/20 ring-1 ring-inset ring-purple-500/50 text-purple-100', hoverRing: 'ring-purple-500/70' },
  hired: { label: 'Anställd', color: 'bg-green-500/20 ring-1 ring-inset ring-green-500/50 text-green-100', hoverRing: 'ring-green-500/70' },
} as const;

// Page size for pagination - optimized for performance
const PAGE_SIZE = 50;

/** Nyckel som används när tavlan inte skickar in några kolumner (t.ex. mobilvyn). */
const ALL_STAGES = '__all__';

/**
 * Keyset-markör per kolumn. `id` är med som tiebreaker eftersom en massflytt
 * ger många rader exakt samma `updated_at` — utan tiebreaker skulle rader
 * hoppas över mellan sidorna.
 */
type StageCursor = { updated_at: string; id: string } | null;
type StagePageParam = Record<string, StageCursor | 'done'>;

function isFirstRound(pageParam: StagePageParam): boolean {
  return Object.keys(pageParam || {}).length === 0;
}

/** En sida ur EN kolumn, sorterad nyast först. */
async function fetchStagePage(
  userId: string,
  listId: string | null,
  stage: string,
  cursor: StageCursor,
): Promise<RawMyCandidateRow[]> {
  let query = supabase
    .from('my_candidates')
    .select('id, application_id, applicant_id, job_id, stage, notes, rating, created_at, updated_at')
    .eq('recruiter_id', userId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (listId) query = query.eq('list_id', listId);
  if (stage !== ALL_STAGES) query = query.eq('stage', stage);
  if (cursor) {
    query = query.or(
      `updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as RawMyCandidateRow[];
}

/** Samma sida, men filtrerad via fulltextsökning på servern. */
async function fetchSearchPage(
  userId: string,
  searchQuery: string,
  listId: string | null,
  stage: string,
  cursor: StageCursor,
): Promise<RawMyCandidateRow[]> {
  const { data, error } = await supabase.rpc('search_my_candidates', {
    p_recruiter_id: userId,
    p_search_query: searchQuery,
    p_limit: PAGE_SIZE,
    p_cursor_updated_at: cursor?.updated_at ?? null,
    p_list_id: listId,
    p_stage: stage === ALL_STAGES ? null : stage,
  });
  if (error) throw error;
  return ((data || []) as any[]).map(row => ({
    id: row.my_candidate_id,
    application_id: row.application_id,
    applicant_id: row.applicant_id,
    job_id: row.job_id,
    stage: row.stage,
    notes: row.notes,
    rating: row.rating,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// 🔥 localStorage cache for instant-load
// v2 bryter gamla cacher som kunde sakna profilmedia/viewed_at och gav FA + ny-prick efter hard refresh.
const MY_CANDIDATES_CACHE_KEY = 'parium_my_candidates_v2_';
// Stale-while-revalidate: listan hämtas ändå om vid varje mount (staleTime: 0),
// så cachen finns bara till för att första painten ska vara instant. En 5-min
// TTL innebar att varje besök efter en kafferast började med tom tavla och att
// medielänkarna signerades från noll (initialer/tom cirkel i ~0,5 s).
const MY_CANDIDATES_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CachedMyCandidates {
  items: MyCandidateData[];
  timestamp: number;
}

/** Cachen är per lista — annars läcker kandidater mellan listorna vid cold start. */
export function myCandidatesCacheKey(userId: string, listId: string | null = null): string {
  return MY_CANDIDATES_CACHE_KEY + userId + (listId ? `_${listId}` : '');
}

function readMyCandidatesCache(userId: string, listId: string | null = null): MyCandidateData[] | null {
  try {
    const key = myCandidatesCacheKey(userId, listId);
    const cached = safeReadJsonCache<CachedMyCandidates>(key, (value): value is CachedMyCandidates => {
      const cache = value as Partial<CachedMyCandidates>;
      return Array.isArray(cache.items) && typeof cache.timestamp === 'number';
    });
    if (!cached || Date.now() - cached.timestamp > MY_CANDIDATES_CACHE_MAX_AGE_MS) return null;
    const deduplicated = deduplicateByApplicant(cached.items || []);

    // Självläk gamla cacher som fortfarande innehåller dubbletter
    if (deduplicated.length !== (cached.items || []).length) {
      safeSetItem(key, JSON.stringify({
        ...cached,
        items: deduplicated,
      }));
    }

    return deduplicated;
  } catch {
    return null;
  }
}

function readMyCandidatesCacheTimestamp(userId: string, listId: string | null = null): number | null {
  const key = myCandidatesCacheKey(userId, listId);
  const cached = safeReadJsonCache<CachedMyCandidates>(key, (value): value is CachedMyCandidates => {
    const cache = value as Partial<CachedMyCandidates>;
    return Array.isArray(cache.items) && typeof cache.timestamp === 'number';
  });
  return cached ? cached.timestamp : null;
}

function deduplicateByApplicant(items: MyCandidateData[]): MyCandidateData[] {
  const seen = new Map<string, MyCandidateData>();
  for (const c of items) {
    const existing = seen.get(c.applicant_id);
    if (!existing || c.updated_at > existing.updated_at) {
      seen.set(c.applicant_id, c);
    }
  }
  return Array.from(seen.values());
}

function writeMyCandidatesCache(userId: string, items: MyCandidateData[], listId: string | null = null): void {
  try {
    const key = myCandidatesCacheKey(userId, listId);
    const cached: CachedMyCandidates = {
      items: deduplicateByApplicant(items).slice(0, 100),
      timestamp: Date.now(),
    };
    safeSetItem(key, JSON.stringify(cached));
  } catch {
    // Storage full
  }
}

function updateMyCandidatesCache(
  userId: string | undefined,
  updater: (items: MyCandidateData[]) => MyCandidateData[],
  listId: string | null = null
): void {
  if (!userId) return;
  const cached = readMyCandidatesCache(userId, listId);
  if (!cached) return;
  writeMyCandidatesCache(userId, updater(cached), listId);
}

/**
 * `stages` = kolumnerna som tavlan visar. När den anges hämtas kandidaterna
 * PER KOLUMN med egen markör, i stället för en global lista som måste laddas
 * i sin helhet innan en djup kolumn blir komplett.
 */
export function useMyCandidatesData(
  searchQuery: string = '',
  listId: string | null = null,
  stages?: string[],
) {
  const { user } = useAuth();
  const instanceId = useId();

  const queryClient = useQueryClient();

  const stageList = useMemo(() => (stages && stages.length > 0 ? stages : null), [stages]);
  const stagesKey = useMemo(() => (stageList ? [...stageList].sort().join('|') : ''), [stageList]);

  // Stable query key for optimistic updates (must match useInfiniteQuery key exactly)
  const queryKey = useMemo(
    () => ['my-candidates', user?.id, searchQuery, listId, stagesKey] as const,
    [user?.id, searchQuery, listId, stagesKey],
  );

  // Realtime-effekterna har medvetet smala dependencies (annars prenumererar de
  // om vid varje sökbokstav). Utan den här refen skrev de till en INAKTUELL
  // query-nyckel så fort man sökte eller bytte lista — uppdateringen syntes då
  // aldrig i vyn som faktiskt visas.
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  // Samma sak för aktiv lista: filtret nedan låste sig annars vid den lista som
  // var vald när kanalen skapades.
  const listIdRef = useRef(listId);
  listIdRef.current = listId;

  // Vilka kolumner som bett om nästa sida just nu (tom = första omgången).
  const requestedStagesRef = useRef<Set<string>>(new Set());


  // Nya kandidater hamnar i listan användaren jobbar i just nu (även när de
  // läggs till från /candidates, där hooken anropas utan list-id).
  const insertListId = listId ?? getActiveCandidateListId(user?.id);

  // 🔥 Auto-sync queued candidate operations when connectivity returns
  useCandidateOperationQueue(user?.id);
  const [isDragging, setIsDragging] = useState(false);

  // Check for cached data BEFORE query runs (only for non-search queries)
  const hasCachedData = user && !searchQuery ? readMyCandidatesCache(user.id, listId) !== null : false;

  // Use infinite query for scalable pagination (handles 100k+ candidates)
  const {
    data,
    isLoading: queryLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    initialPageParam: {} as StagePageParam,
    queryFn: async ({ pageParam }) => {
      if (!user) return { items: [], cursors: {} as StagePageParam };

      const targets = stageList ?? [ALL_STAGES];
      let pending = targets.filter(stage => pageParam[stage] !== 'done');
      // Scrollar du i EN kolumn ska bara den kolumnen hämta nästa sida.
      // Utan detta drog varje "ladda mer" in 50 nya rader i samtliga kolumner.
      // Tom uppsättning = första omgången → alla kolumner hämtas.
      const requested = requestedStagesRef.current;
      if (requested.size > 0) {
        const narrowed = pending.filter(stage => requested.has(stage));
        if (narrowed.length > 0) pending = narrowed;
      }
      if (pending.length === 0) return { items: [], cursors: pageParam };


      const trimmedSearch = searchQuery.trim();

      // En förfrågan per kolumn — alla serveras av indexet
      // (recruiter_id, list_id, stage, updated_at desc), så svarstiden är
      // konstant oavsett hur många kandidater listan innehåller totalt.
      const results = await Promise.all(
        pending.map(async (stage) => {
          const cursor = (pageParam[stage] ?? null) as StageCursor;
          const rows = trimmedSearch
            ? await fetchSearchPage(user.id, trimmedSearch, listId, stage, cursor)
            : await fetchStagePage(user.id, listId, stage, cursor);
          return { stage, rows };
        }),
      );

      // EN hydrering för hela omgången → tre nätverksanrop totalt, inte tre per kolumn.
      const allRows = results.flatMap(r => r.rows);
      const items = await hydrateMyCandidateRows(user.id, allRows);

      const cursors: StagePageParam = { ...pageParam };
      for (const { stage, rows } of results) {
        const last = rows[rows.length - 1];
        cursors[stage] = rows.length < PAGE_SIZE || !last
          ? 'done'
          : { updated_at: last.updated_at, id: last.id };
      }

      // 🔥 Cacha första omgången för instant-load nästa besök (ej vid sökning)
      if (isFirstRound(pageParam) && !trimmedSearch && items.length > 0) {
        writeMyCandidatesCache(user.id, items, listId);
      }

      return { items, cursors };
    },
    getNextPageParam: (lastPage) => {
      const cursors = lastPage.cursors || {};
      const hasMore = Object.values(cursors).some(v => v !== 'done');
      return hasMore ? cursors : undefined;
    },
    enabled: !!user,
    staleTime: 0,
    // List/search query variants are disposable; bound memory in long sessions.
    gcTime: 15 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    // 🔥 Instant-load from localStorage cache (only for non-search queries)
    initialData: () => {
      if (!user || searchQuery) return undefined;
      const cached = readMyCandidatesCache(user.id, listId);
      if (!cached || cached.length === 0) return undefined;
      // Markörerna är okända för cachad data → låt första nätverksomgången
      // sätta dem. Tavlan målas direkt, riktiga siffror kommer från RPC:n.
      return {
        pages: [{ items: cached, cursors: {} as StagePageParam }],
        pageParams: [{} as StagePageParam],
      };
    },
    initialDataUpdatedAt: () => {
      if (!user || searchQuery) return undefined;
      return readMyCandidatesCacheTimestamp(user.id, listId) ?? undefined;
    },
  });

  // Vilka kolumner har fler kandidater kvar på servern? Driver kolumnernas
  // "ladda mer när du scrollar nära botten".
  const cursorsByStage = useMemo(() => {
    const pages = data?.pages || [];
    return (pages[pages.length - 1]?.cursors || {}) as StagePageParam;
  }, [data]);

  const hasMoreInStage = useCallback(
    (stage: string) => {
      if (!stageList) return !!hasNextPage;
      const value = cursorsByStage[stage];
      // Okänt läge (t.ex. direkt från localStorage-cachen) → anta att det finns mer.
      return value !== 'done';
    },
    [stageList, cursorsByStage, hasNextPage],
  );

  const loadMoreStage = useCallback((stage?: string) => {
    if (!hasNextPage || isFetchingNextPage) return;
    // Endast den kolumn som scrollades hämtar nästa sida.
    requestedStagesRef.current = stage ? new Set([stage]) : new Set();
    void fetchNextPage().finally(() => {
      requestedStagesRef.current = new Set();
    });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


  // 🔥 Only show loading if we don't have cached data
  const isLoading = queryLoading && !hasCachedData;

  // Flatten all pages into single array, deduplicated by applicant_id (one row per person)
  const candidates = useMemo(() => {
    const raw = data?.pages.flatMap(page => page.items) || [];
    const seen = new Map<string, MyCandidateData>();
    for (const c of raw) {
      const existing = seen.get(c.applicant_id);
      // Keep the most recently updated entry per person
      if (!existing || c.updated_at > existing.updated_at) {
        seen.set(c.applicant_id, c);
      }
    }
    return Array.from(seen.values());
  }, [data]);

  // Signera avatar-/videomedia direkt för de rader som faktiskt visas.
  // Nätverkssvaret gör redan detta, men när listan kommer från localStorage
  // (instant-load) finns inget svar att haka på — då hann korten annars visa
  // en tom platta ~en halv sekund innan bilden dök upp.
  // Körs SYNKRONT under render (inte i en effekt) så signeringen startar innan
  // första målningen — annars hinner kortet ritas en gång utan media.
  // Tak per omgång: max 200 nya rader förvärms åt gången. Redan förvärmda
  // hoppas över, så nästa omgång tar vid där den förra slutade. Utan tak skulle
  // en lista med 3 000 kandidater trigga 3 000 signeringar och lika många
  // videohämtningar på en gång.
  const WARM_PER_RUN = 200;
  const warmedMediaRef = useRef<Set<string>>(new Set());
  useMemo(() => {
    if (candidates.length === 0) return;
    const warmed = warmedMediaRef.current;
    let budget = WARM_PER_RUN;
    for (const c of candidates) {
      if (budget <= 0) break;
      const img = typeof c.profile_image_url === 'string' ? c.profile_image_url.trim() : '';
      const vid = c.is_profile_video && typeof c.video_url === 'string' ? c.video_url.trim() : '';
      const isNew = (img && !warmed.has(`i:${img}`)) || (vid && !warmed.has(`v:${vid}`));
      if (!isNew) continue;
      budget -= 1;
      if (img && !warmed.has(`i:${img}`)) {
        warmed.add(`i:${img}`);
        void prefetchMediaUrl(img, 'profile-image', MEDIA_URL_TTL, AVATAR_TRANSFORM);
      }
      if (vid && !warmed.has(`v:${vid}`)) {
        warmed.add(`v:${vid}`);
        void prefetchMediaUrl(vid, 'profile-video', MEDIA_URL_TTL);
      }
    }
    // Förvärm full-size porträtt för de översta raderna → profil-dialogen
    // öppnas med bilden på plats (aldrig initialer eller tom cirkel).
    for (const c of candidates.slice(0, 24)) {
      const img = typeof c.profile_image_url === 'string' ? c.profile_image_url.trim() : '';
      if (img && !warmed.has(`f:${img}`)) {
        warmed.add(`f:${img}`);
        void prefetchMediaUrl(img, 'profile-image', MEDIA_URL_TTL);
      }
    }
  }, [candidates]);



  // Real-time subscription for my_candidates changes (all users for team sync)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my-candidates-team-sync:${instanceId}`)

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
        },
        (payload: any) => {
          // Don't apply realtime changes during drag/drop optimistic updates
          if (isDragging) return;

          // For the common case (stage change), update cache in-place to avoid
          // refetch jitter that makes drag/drop feel "laggy".
          if (payload?.eventType === 'UPDATE' && payload?.new?.id) {
            const next = payload.new as { id: string; stage?: CandidateStage; recruiter_id?: string; list_id?: string | null };

            // Only update if it's the current user's candidate — och fortfarande i samma lista
            const activeListId = listIdRef.current;
            const sameList = !activeListId || !next.list_id || next.list_id === activeListId;
            if (next.recruiter_id === user.id && next.stage && sameList) {
              queryClient.setQueryData(
                queryKeyRef.current,
                (old: any) => {
                  if (!old?.pages) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      items: page.items.map((c: MyCandidateData) =>
                        c.id === next.id
                          ? { ...c, stage: next.stage!, updated_at: (next as any).updated_at || new Date().toISOString() }
                          : c
                      ),
                    })),
                  };
                }
              );
              return;
            }
          }

          // Fallback: refetch for other changes (insert/delete/unknown updates)
          // This catches changes made by colleagues that affect shared data
          queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, isDragging]);

  // 🔥 Stable ref for applicant IDs — prevents realtime channels from
  // re-subscribing every time the candidate list changes.
  const applicantIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    applicantIdsRef.current = new Set(candidates.map(c => c.applicant_id));
  }, [candidates]);

  // Real-time subscription for activity updates (profiles.last_active_at and job_applications)
  // Dependencies are intentionally limited to user/queryClient to keep the channel stable.
  useEffect(() => {
    if (!user) return;

    const profilesChannel = supabase
      .channel(`candidate-activity-profiles:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload: any) => {
          const updatedUserId = payload.new?.user_id;
          if (updatedUserId && applicantIdsRef.current.has(updatedUserId)) {
            const newLastActiveAt = payload.new?.last_active_at;
            queryClient.setQueryData(
              queryKeyRef.current,
              (old: any) => {
                if (!old?.pages) return old;
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    items: page.items.map((c: MyCandidateData) =>
                      c.applicant_id === updatedUserId
                        ? { ...c, last_active_at: newLastActiveAt }
                        : c
                    ),
                  })),
                };
              }
            );
          }
        }
      )
      .subscribe();

    const applicationsChannel = supabase
      .channel(`candidate-activity-applications:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications',
        },
        (payload: any) => {
          const applicantId = payload.new?.applicant_id;
          const appliedAt = payload.new?.applied_at;
          if (applicantId && applicantIdsRef.current.has(applicantId) && appliedAt) {
            queryClient.setQueryData(
              queryKeyRef.current,
              (old: any) => {
                if (!old?.pages) return old;
                return {
                  ...old,
                  pages: old.pages.map((page: any) => ({
                    ...page,
                    items: page.items.map((c: MyCandidateData) =>
                      c.applicant_id === applicantId
                        ? { ...c, latest_application_at: appliedAt }
                        : c
                    ),
                  })),
                };
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(applicationsChannel);
    };
  }, [user, queryClient]);

  // Real-time subscription for persistent ratings AND notes
  // Combined into a single effect to reduce channel overhead.
  useEffect(() => {
    if (!user) return;

    const ratingsChannel = supabase
      .channel(`candidate-ratings-sync:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_ratings',
        },
        (payload: any) => {
          const next = payload?.new as { applicant_id?: string; rating?: number; recruiter_id?: string } | undefined;
          // In-place cache update for own ratings to avoid full refetch
          if (next?.applicant_id && next?.recruiter_id === user.id && typeof next.rating === 'number') {
            queryClient.setQueryData(queryKeyRef.current, (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  items: page.items.map((c: MyCandidateData) =>
                    c.applicant_id === next.applicant_id ? { ...c, rating: next.rating! } : c
                  ),
                })),
              };
            });
          } else {
            // Team member rating change — invalidate
            queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
          }
          queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
        }
      )
      .subscribe();

    const notesChannel = supabase
      .channel(`candidate-notes-sync:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_notes',
        },
        (payload: any) => {
          const next = payload?.new as { applicant_id?: string; note?: string; employer_id?: string } | undefined;
          // In-place cache update for own notes
          if (next?.applicant_id && next?.employer_id === user.id && typeof next.note === 'string') {
            queryClient.setQueryData(queryKeyRef.current, (old: any) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  items: page.items.map((c: MyCandidateData) =>
                    c.applicant_id === next.applicant_id ? { ...c, notes: next.note! } : c
                  ),
                })),
              };
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
          }
          queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ratingsChannel);
      supabase.removeChannel(notesChannel);
    };
  }, [user, queryClient]);

  // Add candidate to my list
  const addCandidate = useMutation({
    mutationFn: async ({ applicationId, applicantId, jobId }: { applicationId: string; applicantId: string; jobId?: string }) => {
      if (!getIsOnline()) throw new Error('Du är offline – anslut och försök igen');
      if (!user) throw new Error('Not authenticated');

      // Add to the first available stage (avoids adding to deleted stages)
      const { data: stageSettings } = await supabase
        .from('user_stage_settings')
        .select('stage_key, order_index')
        .eq('user_id', user.id)
        .eq('list_id', insertListId)
        .gt('order_index', -1)
        .order('order_index', { ascending: true })
        .limit(1);

      const defaultStage = stageSettings?.[0]?.stage_key || 'to_contact';

      // Check for existing persistent rating for this applicant
      const { data: existingRating } = await supabase
        .from('candidate_ratings')
        .select('rating')
        .eq('recruiter_id', user.id)
        .eq('applicant_id', applicantId)
        .maybeSingle();

      const restoredRating = existingRating?.rating || 0;

      // Check for existing persistent notes for this applicant
      const { data: existingNote } = await supabase
        .from('candidate_notes')
        .select('note')
        .eq('employer_id', user.id)
        .eq('applicant_id', applicantId)
        .is('job_id', null) // Global note
        .maybeSingle();

      const restoredNotes = existingNote?.note || null;

      const { data, error } = await supabase
        .from('my_candidates')
        .insert({
          recruiter_id: user.id,
          applicant_id: applicantId,
          application_id: applicationId,
          job_id: jobId || null,
          list_id: insertListId,
          stage: defaultStage,
          rating: restoredRating, // Restore previous rating if exists
          notes: restoredNotes, // Restore previous notes if exists
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Kandidaten finns redan i din lista');
        }
        throw error;
      }


      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      toast.success('Kandidat tillagd i din lista');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kunde inte lägga till kandidaten');
    },
  });

  // Add multiple candidates at once (bulk action)
  const addCandidates = useMutation({
    mutationFn: async (candidates: Array<{ applicationId: string; applicantId: string; jobId?: string }>) => {
      if (!getIsOnline()) throw new Error('Du är offline – anslut och försök igen');
      if (!user) throw new Error('Not authenticated');

      // First, check which candidates already exist in my_candidates
      const applicationIds = candidates.map(c => c.applicationId);
      const { data: existing } = await supabase
        .from('my_candidates')
        .select('application_id')
        .eq('recruiter_id', user.id)
        .in('application_id', applicationIds);

      const existingIds = new Set(existing?.map(e => e.application_id) || []);
      
      // Filter out candidates that already exist
      const newCandidates = candidates.filter(c => !existingIds.has(c.applicationId));
      
      if (newCandidates.length === 0) {
        return { inserted: 0, alreadyExisted: candidates.length };
      }

      // Get the user's stage settings to find the first available stage
      const { data: stageSettings } = await supabase
        .from('user_stage_settings')
        .select('stage_key, order_index, custom_label')
        .eq('user_id', user.id)
        .eq('list_id', insertListId)
        .gt('order_index', -1) // Exclude deleted stages
        .order('order_index', { ascending: true })
        .limit(1);

      // Use the first available stage, or fall back to 'to_contact' if no stages configured
      const defaultStage = stageSettings?.[0]?.stage_key || 'to_contact';

      // Check for existing persistent ratings for these applicants
      const applicantIds = newCandidates.map(c => c.applicantId);
      const { data: existingRatings } = await supabase
        .from('candidate_ratings')
        .select('applicant_id, rating')
        .eq('recruiter_id', user.id)
        .in('applicant_id', applicantIds);

      const ratingsMap = new Map(existingRatings?.map(r => [r.applicant_id, r.rating]) || []);

      // Check for existing persistent notes for these applicants
      const { data: existingNotes } = await supabase
        .from('candidate_notes')
        .select('applicant_id, note')
        .eq('employer_id', user.id)
        .is('job_id', null) // Global notes only
        .in('applicant_id', applicantIds);

      const notesMap = new Map(existingNotes?.map(n => [n.applicant_id, n.note]) || []);

      const insertData = newCandidates.map(c => ({
        recruiter_id: user.id,
        applicant_id: c.applicantId,
        application_id: c.applicationId,
        job_id: c.jobId || null,
        list_id: insertListId,
        stage: defaultStage,
        rating: ratingsMap.get(c.applicantId) || 0, // Restore previous rating
        notes: notesMap.get(c.applicantId) || null, // Restore previous notes
      }));

      const { data, error } = await supabase
        .from('my_candidates')
        .insert(insertData)
        .select();

      if (error) throw error;


      return { inserted: data?.length || 0, alreadyExisted: existingIds.size };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      if (result.inserted > 0) {
        toast.success(`${result.inserted} kandidat${result.inserted !== 1 ? 'er' : ''} tillagd${result.inserted !== 1 ? 'a' : ''} i din lista`);
      } else if (result.alreadyExisted > 0) {
        toast.info('Kandidaterna finns redan i din lista');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kunde inte lägga till kandidaterna');
    },
  });

  // Move candidate to different stage (with retry queue fallback)
  const moveCandidate = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: CandidateStage }) => {
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ stage })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: ({ id, stage }) => {
      // Mark as dragging to prevent realtime from overwriting
      setIsDragging(true);

      // Optimistic update - MUST be synchronous to feel instant (paginated structure)
      void queryClient.cancelQueries({ queryKey });
      const previousCandidates = queryClient.getQueryData(queryKey);

      // Servern sätter updated_at = now() vid flytt, vilket gör att kortet
      // hamnar överst i målkolumnen. Speglas här så att ett kort du drar från
      // plats 5 000 inte "försvinner" ner i den nya kolumnen tills nästa hämtning.
      const movedAt = new Date().toISOString();
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((c: MyCandidateData) =>
              c.id === id ? { ...c, stage, updated_at: movedAt } : c
            ),
          })),
        };
      });


      return { previousCandidates };
    },
    onError: (err, variables, context) => {
      // Don't rollback optimistic update — enqueue for retry instead
      if (user) {
        const candidate = candidates.find(c => c.id === variables.id);
        enqueueCandidateOperation({
          type: 'stage_move',
          candidateId: variables.id,
          recruiterId: user.id,
          payload: { stage: variables.stage },
          candidateName: candidate ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() : undefined,
        });
        toast.info('Flytten köad – synkas automatiskt', { duration: 3000 });
      } else {
        queryClient.setQueryData(queryKey, context?.previousCandidates);
        toast.error('Kunde inte flytta kandidaten');
      }
    },
    onSettled: () => {
      setIsDragging(false);
    },
  });

  // Remove candidate from my list (with retry queue fallback)
  const removeCandidate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('my_candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async (id: string) => {
      // Optimistic removal
      await queryClient.cancelQueries({ queryKey });
      const previousCandidates = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.filter((c: MyCandidateData) => c.id !== id),
          })),
        };
      });

      return { previousCandidates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      toast.success('Kandidat borttagen från din lista');
    },
    onError: (err, id, context) => {
      if (user) {
        const candidate = (context?.previousCandidates as any)?.pages?.flatMap((p: any) => p.items)?.find((c: MyCandidateData) => c.id === id);
        enqueueCandidateOperation({
          type: 'remove',
          candidateId: id,
          recruiterId: user.id,
          payload: {},
          candidateName: candidate ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() : undefined,
        });
        toast.info('Borttagning köad – synkas automatiskt', { duration: 3000 });
      } else {
        queryClient.setQueryData(queryKey, context?.previousCandidates);
        toast.error('Kunde inte ta bort kandidaten');
      }
    },
  });

  // Update notes - also saves to persistent candidate_notes table (with retry queue fallback)
  const updateNotes = useMutation({
    mutationFn: async ({ id, notes, applicantId }: { id: string; notes: string; applicantId?: string }) => {
      // Update my_candidates notes
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ notes })
        .eq('id', id)
        .select('applicant_id')
        .single();

      if (error) throw error;

      // Also save to persistent candidate_notes table (upsert by employer_id + applicant_id)
      const targetApplicantId = applicantId || data?.applicant_id;
      if (targetApplicantId && user) {
        const { data: existingNote } = await supabase
          .from('candidate_notes')
          .select('id')
          .eq('employer_id', user.id)
          .eq('applicant_id', targetApplicantId)
          .is('job_id', null)
          .maybeSingle();

        if (existingNote) {
          await supabase
            .from('candidate_notes')
            .update({ note: notes })
            .eq('id', existingNote.id);
        } else if (notes.trim()) {
          await supabase
            .from('candidate_notes')
            .insert({
              employer_id: user.id,
              applicant_id: targetApplicantId,
              note: notes,
              job_id: null,
            });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
    },
    onError: (err, variables) => {
      if (user) {
        enqueueCandidateOperation({
          type: 'notes_update',
          candidateId: variables.id,
          applicantId: variables.applicantId,
          recruiterId: user.id,
          payload: { notes: variables.notes },
        });
        // Silent — notes feel "saved" via optimistic update
      } else {
        toast.error('Kunde inte uppdatera anteckningar');
      }
    },
  });

  // Update rating - also saves to persistent candidate_ratings table (with retry queue fallback)
  const updateRating = useMutation({
    mutationFn: async ({ id, rating, applicantId }: { id: string; rating: number; applicantId?: string }) => {
      // Update my_candidates rating
      const { data, error } = await supabase
        .from('my_candidates')
        .update({ rating })
        .eq('id', id)
        .select('applicant_id')
        .single();

      if (error) throw error;

      // Samma kandidat kan ligga i flera listor — håll alla rader i synk så att
      // betyget inte "försvinner" när man öppnar kortet från en annan lista.
      const spreadApplicantId = applicantId || data?.applicant_id;
      if (spreadApplicantId && user) {
        await supabase
          .from('my_candidates')
          .update({ rating })
          .eq('recruiter_id', user.id)
          .eq('applicant_id', spreadApplicantId);
      }

      // Also save to persistent candidate_ratings table (upsert)
      const targetApplicantId = applicantId || data?.applicant_id;
      if (targetApplicantId && user) {
        await supabase
          .from('candidate_ratings')
          .upsert({
            recruiter_id: user.id,
            applicant_id: targetApplicantId,
            rating,
          }, {
            onConflict: 'recruiter_id,applicant_id',
          });
        
        // Update localStorage ratings cache for instant sync with /candidates
        try {
          const cacheKey = `ratings_cache_${user.id}`;
          const raw = localStorage.getItem(cacheKey);
          const cache = raw ? JSON.parse(raw) : { ratings: {}, timestamp: Date.now() };
          cache.ratings[targetApplicantId] = rating;
          cache.timestamp = Date.now();
          safeSetItem(cacheKey, JSON.stringify(cache));
        } catch {
          // Ignore localStorage errors
        }
      }

      return data;
    },
    onMutate: async ({ id, rating, applicantId }) => {
      // Optimistic update (paginated structure)
      await queryClient.cancelQueries({ queryKey });
      const previousCandidates = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((c: MyCandidateData) =>
              c.id === id || (applicantId && c.applicant_id === applicantId) ? { ...c, rating } : c
            ),
          })),
        };
      });
      
      // Also optimistically update applications cache for /candidates.
      // Uppdaterar ALLA applications-cachar (även filtrerade sökningar), inte
      // bara den med tom söksträng.
      if (applicantId) {
        queryClient.setQueriesData({ queryKey: ['applications', user?.id] }, (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: (page.items || []).map((app: any) =>
                app.applicant_id === applicantId ? { ...app, rating } : app
              ),
            })),
          };
        });
      }
      
      return { previousCandidates };
    },
    onError: (err, variables, context) => {
      // Don't rollback — keep optimistic update and enqueue for retry
      if (user) {
        enqueueCandidateOperation({
          type: 'rating_update',
          candidateId: variables.id,
          applicantId: variables.applicantId,
          recruiterId: user.id,
          payload: { rating: variables.rating },
        });
        // Silent — rating feels "saved" via optimistic update
      } else {
        queryClient.setQueryData(queryKey, context?.previousCandidates);
        toast.error('Kunde inte uppdatera betyg');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['team-candidate-info'] });
      queryClient.invalidateQueries({ queryKey: ['applications', user?.id] });
    },
  });

  // Group candidates by stage (dynamic — supports custom stages)
  const candidatesByStage = useMemo(() => {
    const grouped: Record<string, MyCandidateData[]> = {};

    candidates.forEach(candidate => {
      if (!grouped[candidate.stage]) {
        grouped[candidate.stage] = [];
      }
      grouped[candidate.stage].push(candidate);
    });

    return grouped;
  }, [candidates]);

  // Stats (dynamic — supports custom stages)
  const stats = useMemo(() => {
    const stageStats: Record<string, number> = {};
    Object.entries(candidatesByStage).forEach(([stage, items]) => {
      stageStats[stage] = items.length;
    });
    return {
      total: candidates.length,
      ...stageStats,
    };
  }, [candidates, candidatesByStage]);

  // Check if an application is already in my candidates
  const isInMyCandidates = useCallback((applicationId: string) => {
    return candidates.some(c => c.application_id === applicationId);
  }, [candidates]);

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
      // Optimistic update (paginated structure)
      await queryClient.cancelQueries({ queryKey });
      const viewedAt = new Date().toISOString();
      markViewedInSession(applicationId);
      updateMyCandidatesCache(user?.id, (items) =>
        items.map((c) =>
          c.application_id === applicationId ? { ...c, viewed_at: viewedAt } : c
        ),
        listId
      );
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((c: MyCandidateData) =>
              c.application_id === applicationId 
                ? { ...c, viewed_at: viewedAt } 
                : c
            ),
          })),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-candidates', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  // True while background-refetching with stale cache — hides add-button to prevent flicker
  const isMyCandidatesSettling = isFetching && !queryLoading;

  return {
    candidates,
    candidatesByStage,
    stats,
    isLoading,
    isMyCandidatesSettling,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    /** Hämtar nästa 50 i varje kolumn som fortfarande har fler kandidater. */
    loadMoreStage,
    /** Har den här kolumnen fler kandidater kvar på servern? */
    hasMoreInStage,
    addCandidate,
    addCandidates,
    moveCandidate,
    removeCandidate,
    updateNotes,
    updateRating,
    isInMyCandidates,
    markAsViewed,
  };
}
