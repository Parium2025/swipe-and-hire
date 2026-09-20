import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { resolveCandidateMedia } from '@/lib/candidateMedia';
import { getActiveCandidateListId } from '@/lib/activeCandidateList';
import { hydrateMyCandidateRows } from '@/lib/myCandidatesHydration';
import { fetchMyApplicationViews, resolveApplicationViewedAt } from '@/lib/applicationViews';
import { useAuth } from '@/hooks/useAuth';
import { updateLastSyncTime } from '@/lib/draftUtils';

const PAGE_SIZE = 50; // Större batch för att ha mer data redo
const STAGE_SETTINGS_CACHE_KEY = 'stage_settings_cache_';
// Debounce-fönster: vid burst av realtime-events (t.ex. bulk-uppdatering)
// kör vi bara EN sync efter att eventerna lugnat sig.
const REALTIME_DEBOUNCE_MS = 800;

/**
 * Hook som håller kandidatdata färsk i bakgrunden via Supabase Realtime.
 *
 * STRATEGI (skalbar):
 * 1. EN initial sync vid mount (ingen polling)
 * 2. Realtime-subscriptions FILTRERADE på recruiter/employer_id
 *    → vi får BARA pushar som rör vår egen data
 * 3. Debounced sync vid burst av events (sparar queries)
 *
 * VIKTIGT: Tidigare hade vi setInterval var 10s + ofiltrerad realtime →
 * 8 queries × 10s × N användare = ohållbart vid skala.
 * Realtime + filter räcker; tab-focus-recovery hanteras av RealtimeKeepAlive.
 */
/** Senast synkade tidsstämplar per användare – styr när kanban-vyn hämtar om sig. */
const lastMyCandidatesSignature = new Map<string, string>();

export const useCandidateBackgroundSync = (enabled = true) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isRunningRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !enabled) return;

    const userId = user.id;

    const syncCandidates = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        await Promise.all([
          syncApplicationsData(userId, queryClient),
          syncMyCandidatesData(userId, queryClient),
          syncStageSettings(userId, queryClient),
        ]);
        updateLastSyncTime();
      } catch (error) {
        console.warn('Background candidate sync failed:', error);
      } finally {
        isRunningRef.current = false;
      }
    };

    // Debouncad sync — coalescar burst av realtime-events till EN sync
    const scheduleSync = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        syncCandidates();
      }, REALTIME_DEBOUNCE_MS);
    };

    // Initial sync vid mount
    syncCandidates();

    // Realtime FILTRERAD på den inloggade användaren.
    // För job_applications finns ingen direkt employer-kolumn — den syncen
    // triggas istället via my_candidates/candidate_ratings/notes (alla rör
    // samma kandidat-pool) samt via useEmployerBackgroundSync för nya ansökningar.
    channelRef.current = createRealtimeChannel(`candidate-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
          filter: `recruiter_id=eq.${userId}`,
        },
        scheduleSync
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_ratings',
          filter: `recruiter_id=eq.${userId}`,
        },
        scheduleSync
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_notes',
          filter: `employer_id=eq.${userId}`,
        },
        scheduleSync
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, enabled, queryClient]);
};

/**
 * Synka "Alla kandidater" data (job_applications)
 */
async function syncApplicationsData(userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  const queryKey = ['applications', userId, '', '[]', null, 'applied_at'];
  const PAGE_SIZE = 50;

  // Hämta första sidan med kandidater
  const { data: baseData, error: baseError } = await supabase
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
      candidate_profile_label,
      profile_image_snapshot_url,
      video_snapshot_url,
      cover_image_snapshot_url,
      status,
      applied_at,
      updated_at,
      viewed_at,
      job_postings!inner(title, occupation, employer_id)
    `)
    .order('applied_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (baseError || !baseData) return;

  // Hämta media batch
  const applicantIds = [...new Set(baseData.map((item: any) => item.applicant_id))];
  const profileMediaMap: Record<string, any> = {};

  const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
    p_applicant_ids: applicantIds,
    p_employer_id: userId,
  });

  if (batchMediaData && Array.isArray(batchMediaData)) {
    batchMediaData.forEach((row: any) => {
      profileMediaMap[row.applicant_id] = {
        profile_image_url: row.profile_image_url,
        video_url: row.video_url,
        cover_image_url: row.cover_image_url ?? null,
        is_profile_video: row.is_profile_video,
        last_active_at: row.last_active_at,
      };
    });
  }

  // Hämta aktivitetsdata och betyg batch parallellt
  const activityMap: Record<string, any> = {};
  const ratingsMap: Record<string, number> = {};
  
  const [activityResult, ratingsResult, myViews] = await Promise.all([
    supabase.rpc('get_applicant_latest_activity', {
      p_applicant_ids: applicantIds,
      p_employer_id: userId,
    }),
    supabase
      .from('candidate_ratings')
      .select('applicant_id, rating')
      .eq('recruiter_id', userId)
      .in('applicant_id', applicantIds),
    // Läst-markering följer ägarregeln (personlig på egna annonser, delad på kollegors).
    fetchMyApplicationViews(baseData.map((item: any) => item.id)).catch(() => new Map<string, string>()),
  ]);

  if (activityResult.data) {
    activityResult.data.forEach((item: any) => {
      activityMap[item.applicant_id] = {
        latest_application_at: item.latest_application_at,
        last_active_at: item.last_active_at,
      };
    });
  }
  
  if (ratingsResult.data) {
    ratingsResult.data.forEach((row: any) => {
      ratingsMap[row.applicant_id] = row.rating;
    });
  }

  // Bygg items
  const items = baseData.map((item: any) => {
    const liveMedia = profileMediaMap[item.applicant_id] || {};
    const media = resolveCandidateMedia(item, liveMedia);
    const activity = activityMap[item.applicant_id] || {};
    const rating = ratingsMap[item.applicant_id] ?? null;

    return {
      ...item,
      viewed_at: resolveApplicationViewedAt(item, myViews, userId, item.id),
      job_title: item.job_postings?.title || 'Okänt jobb',
      job_occupation: item.job_postings?.occupation || null,
      profile_image_url: media.profile_image_url,
      video_url: media.video_url,
      cover_image_url: media.cover_image_url,
      is_profile_video: media.is_profile_video || false,
      last_active_at: activity.last_active_at || liveMedia.last_active_at || null,
      latest_application_at: activity.latest_application_at || item.applied_at,
      rating,
      job_postings: undefined,
    };
  });

  // Uppdatera React Query cache UTAN att trigga re-render om data är samma
  const existingData: any = queryClient.getQueryData(queryKey);
  
  // Jämför om datan har ändrats (baserat på updated_at + rating)
  // Viktigt: rating ligger i candidate_ratings och ändrar INTE job_applications.updated_at.
  // Därför måste rating vara med i signaturen, annars uppdateras aldrig UI:t.
  const newSignature = items.map((i: any) => `${i.id}:${i.updated_at}:${i.rating ?? ''}:${i.profile_image_url ?? ''}:${i.video_url ?? ''}:${i.cover_image_url ?? ''}`).join(',');
  const existingSignature = existingData?.pages?.[0]?.items
    ?.map((i: any) => `${i.id}:${i.updated_at}:${i.rating ?? ''}:${i.profile_image_url ?? ''}:${i.video_url ?? ''}:${i.cover_image_url ?? ''}`)
    ?.join(',');

  if (newSignature !== existingSignature) {
    // Data har ändrats - uppdatera cache.
    // VIKTIGT: Bevara extra sidor som useProgressivePagination kan ha laddat
    // (sida 2-5). Vi byter bara ut sida 1 + dess pageParam.
    const existingPages = existingData?.pages ?? [];
    const existingPageParams = existingData?.pageParams ?? [0];
    const newFirstPage = { items, hasMore: items.length === PAGE_SIZE, nextCursor: items.length === PAGE_SIZE ? items.length : null };

    queryClient.setQueryData(queryKey, {
      pages: existingPages.length > 1
        ? [newFirstPage, ...existingPages.slice(1)]
        : [newFirstPage],
      pageParams: existingPageParams.length > 1
        ? [0, ...existingPageParams.slice(1)]
        : [0],
    });
    console.log('🔄 Candidate sync: updated applications cache (ratings included)');
  }

  // Bildförvärmning ägs av useEmployerMediaWarmup, som lyssnar på exakt de
  // setQueryData-anrop vi gör ovan. Dubbel förvärmning här skickade samma
  // requests två gånger vid varje synk.

  // Uppdatera localStorage snapshot för instant first paint
  try {
    const snapshot = {
      items: items.slice(0, 50),
      timestamp: Date.now(),
    };
    safeSetItem(`applications_snapshot_${userId}`, JSON.stringify(snapshot));
    
    // Spara betyg separat för snabb åtkomst
    if (Object.keys(ratingsMap).length > 0) {
      safeSetItem(`ratings_cache_${userId}`, JSON.stringify({
        ratings: ratingsMap,
        timestamp: Date.now()
      }));
    }
  } catch (cacheError) {
    console.warn('Failed to cache applications snapshot:', cacheError);
  }
}

/**
 * Synka "Mina kandidater" data (my_candidates)
 */
async function syncMyCandidatesData(userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  // Synka den lista användaren senast tittade på — samma nyckel som vyn läser.
  const listId = getActiveCandidateListId(userId);
  const queryKey = ['my-candidates', userId, '', listId, ''];
  const PAGE_SIZE = 50;

  // Hämta första sidan med mina kandidater
  let mcQuery = supabase
    .from('my_candidates')
    .select(`
      id,
      recruiter_id,
      applicant_id,
      application_id,
      job_id,
      stage,
      notes,
      rating,
      created_at,
      updated_at
    `)
    .eq('recruiter_id', userId);

  if (listId) mcQuery = mcQuery.eq('list_id', listId);

  const { data: myCandidates, error: mcError } = await mcQuery
    .order('updated_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (mcError || !myCandidates || myCandidates.length === 0) return;

  // Exakt samma hydrering som vyn själv använder. Tidigare byggdes raderna här
  // med egen logik: betyget togs ur den gamla kolumnen i stället för
  // candidate_ratings, och jobbtiteln fick en annan reservtext. Det skrevs rakt
  // in i samma cache som vyn läser, så bakgrundssynken kunde visa fel betyg.
  const rawItems = await hydrateMyCandidateRows(userId, myCandidates as any);

  // Deduplicera per applicant_id (behåll senast uppdaterad)
  const deduped = new Map<string, (typeof rawItems)[number]>();
  for (const item of rawItems) {
    const existing = deduped.get(item.applicant_id);
    if (!existing || item.updated_at > existing.updated_at) {
      deduped.set(item.applicant_id, item);
    }
  }
  const items = Array.from(deduped.values());

  // Uppdatera React Query cache
  const existingData: any = queryClient.getQueryData(queryKey);
  const newTimestamps = items.map((i) => i.updated_at).join(',');
  const existingTimestamps = existingData?.pages?.[0]?.items?.map((i: any) => i.updated_at)?.join(',');

  if (newTimestamps !== existingTimestamps && existingData?.pages?.length) {
    // Sidan MÅSTE behålla sitt `cursors`-fält. Den gamla koden skrev
    // { items, nextCursor } — en form vyn inte känner igen — vilket fick
    // "ladda fler" att tro att listan var slut efter första sidan.
    const existingPages = existingData.pages as any[];
    const newFirstPage = { ...existingPages[0], items };

    queryClient.setQueryData(queryKey, {
      ...existingData,
      pages: [newFirstPage, ...existingPages.slice(1)],
    });
  }

  // Desktop-kanban läser en annan nyckel (samma lista, men med stegen i
  // nyckeln). Den träffades aldrig av skrivningen ovan, så bakgrundssynken var
  // i praktiken verkningslös där. Vi låter de vyerna hämta om sig i stället —
  // men bara när datan faktiskt ändrats, och aldrig vid första synken efter
  // inloggning (då har vyerna precis hämtat själva).
  const signature = `${listId}:${newTimestamps}`;
  const previousSignature = lastMyCandidatesSignature.get(userId);
  lastMyCandidatesSignature.set(userId, signature);
  if (previousSignature !== undefined && previousSignature !== signature) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return (
          Array.isArray(key) &&
          key[0] === 'my-candidates' &&
          key[1] === userId &&
          key[2] === '' &&
          key[3] === listId &&
          key[4] !== ''
        );
      },
    });
  }

  // Se kommentaren ovan: useEmployerMediaWarmup förvärmer bilderna.
}

/**
 * Synka stage-settings för instant Kanban-vy (ingen "default steg" flicker)
 */
async function syncStageSettings(userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  const listId = getActiveCandidateListId(userId);
  const queryKey = ['stage-settings', userId, listId];

  try {
    let query = supabase
      .from('user_stage_settings')
      .select('*')
      .eq('user_id', userId);

    if (listId) query = query.eq('list_id', listId);

    const { data: settings, error } = await query.order('order_index', { ascending: true });

    if (error || !settings) return;
    
    // Uppdatera React Query cache
    queryClient.setQueryData(queryKey, settings);
    
    // Spara till localStorage för instant first paint nästa gång
    const cacheKey = STAGE_SETTINGS_CACHE_KEY + userId + (listId ? `_${listId}` : '');
    safeSetItem(cacheKey, JSON.stringify({
      settings,
      timestamp: Date.now(),
    }));
  } catch (cacheError) {
    console.warn('Failed to cache stage settings:', cacheError);
  }
}

export default useCandidateBackgroundSync;
