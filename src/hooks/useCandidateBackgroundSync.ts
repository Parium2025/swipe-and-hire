import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { prefetchMediaUrl } from '@/hooks/useMediaUrl';
import { useAuth } from '@/hooks/useAuth';
import { updateLastSyncTime } from '@/lib/draftUtils';

const SYNC_INTERVAL = 10_000; // 10 sekunder som backup-polling
const PAGE_SIZE = 50; // Större batch för att ha mer data redo
const STAGE_SETTINGS_CACHE_KEY = 'stage_settings_cache_';

/**
 * Hook som kontinuerligt förladdar kandidatdata i bakgrunden via:
 * 1. Supabase Realtime - pushar ändringar DIREKT när något ändras i databasen
 * 2. Polling var 10:e sekund som backup
 * 3. Stage-settings prefetch - så Kanban-steg är redo vid navigation
 * 
 * Detta gör att /candidates och /my-candidates alltid har färsk data
 * och visas DIREKT utan laddningsindikator - "bam!"
 */
export const useCandidateBackgroundSync = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    const userId = user.id;

    const syncCandidates = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        // Synka all data parallellt för maximal hastighet
        // Inkluderar nu stage-settings för att eliminera "default steg" flicker
        await Promise.all([
          syncApplicationsData(userId, queryClient),
          syncMyCandidatesData(userId, queryClient),
          syncStageSettings(userId, queryClient),
        ]);
        // Uppdatera sync-tidsstämpel för offline-indikatorn
        updateLastSyncTime();
      } catch (error) {
        console.warn('Background candidate sync failed:', error);
      } finally {
        isRunningRef.current = false;
      }
    };

    // Kör DIREKT vid mount
    syncCandidates();

    // Starta kontinuerlig backup-polling (var 10:e sekund)
    intervalRef.current = setInterval(syncCandidates, SYNC_INTERVAL);

    // Sätt upp Supabase Realtime för INSTANT uppdateringar
    // När någon ändrar job_applications eller my_candidates pushas det direkt hit
    channelRef.current = supabase
      .channel(`candidate-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
        },
        () => {
          // Ny ansökan eller uppdatering - synka direkt!
          syncCandidates();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
        },
        () => {
          // Kandidat flyttad/tillagd/borttagen - synka direkt!
          syncCandidates();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_ratings',
        },
        () => {
          // Betyg ändrat - synka direkt!
          syncCandidates();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candidate_notes',
        },
        () => {
          // Anteckning ändrad - synka direkt!
          syncCandidates();
        }
      )
      .subscribe();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, queryClient]);
};

/**
 * Synka "Alla kandidater" data (job_applications)
 */
async function syncApplicationsData(userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  const queryKey = ['applications', userId, ''];
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
      status,
      applied_at,
      updated_at,
      viewed_at,
      job_postings!inner(title, occupation)
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
        is_profile_video: row.is_profile_video,
        last_active_at: row.last_active_at,
      };
    });
  }

  // Hämta aktivitetsdata och betyg batch parallellt
  const activityMap: Record<string, any> = {};
  const ratingsMap: Record<string, number> = {};
  
  const [activityResult, ratingsResult] = await Promise.all([
    supabase.rpc('get_applicant_latest_activity', {
      p_applicant_ids: applicantIds,
      p_employer_id: userId,
    }),
    supabase
      .from('candidate_ratings')
      .select('applicant_id, rating')
      .eq('recruiter_id', userId)
      .in('applicant_id', applicantIds)
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
    const media = profileMediaMap[item.applicant_id] || {};
    const activity = activityMap[item.applicant_id] || {};
    const rating = ratingsMap[item.applicant_id] ?? null;

    return {
      ...item,
      job_title: item.job_postings?.title || 'Okänt jobb',
      job_occupation: item.job_postings?.occupation || null,
      profile_image_url: media.profile_image_url || null,
      video_url: media.video_url || null,
      is_profile_video: media.is_profile_video || false,
      last_active_at: activity.last_active_at || media.last_active_at || null,
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
  const newSignature = items.map((i: any) => `${i.id}:${i.updated_at}:${i.rating ?? ''}`).join(',');
  const existingSignature = existingData?.pages?.[0]?.items
    ?.map((i: any) => `${i.id}:${i.updated_at}:${i.rating ?? ''}`)
    ?.join(',');

  if (newSignature !== existingSignature) {
    // Data har ändrats - uppdatera cache
    queryClient.setQueryData(queryKey, {
      pages: [{ items, hasMore: items.length === PAGE_SIZE, nextCursor: items.length === PAGE_SIZE ? items.length : null }],
      pageParams: [0],
    });
    console.log('🔄 Candidate sync: updated applications cache (ratings included)');
  }

  // Förladda bilder i bakgrunden
  const imagePaths = items
    .map((i: any) => i.profile_image_url)
    .filter((p: any): p is string => typeof p === 'string' && p.trim() !== '')
    .slice(0, 25);

  if (imagePaths.length > 0) {
    Promise.all(imagePaths.map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {}))).catch(() => {});
  }

  // Uppdatera localStorage snapshot för instant first paint
  try {
    const snapshot = {
      items: items.slice(0, 50),
      timestamp: Date.now(),
    };
    localStorage.setItem(`applications_snapshot_${userId}`, JSON.stringify(snapshot));
    
    // Spara betyg separat för snabb åtkomst
    if (Object.keys(ratingsMap).length > 0) {
      localStorage.setItem(`ratings_cache_${userId}`, JSON.stringify({
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
  const queryKey = ['my-candidates', userId, ''];
  const PAGE_SIZE = 50;

  // Hämta första sidan med mina kandidater
  const { data: myCandidates, error: mcError } = await supabase
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
    .eq('recruiter_id', userId)
    .order('updated_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (mcError || !myCandidates || myCandidates.length === 0) return;

  // Hämta job_applications data
  const applicationIds = myCandidates.map((mc) => mc.application_id);
  const applicantIds = [...new Set(myCandidates.map((mc) => mc.applicant_id))];

  const { data: applications } = await supabase
    .from('job_applications')
    .select(`
      id, applicant_id, first_name, last_name, email, phone, location, bio,
      cv_url, age, employment_status, work_schedule, availability, custom_answers,
      status, applied_at, viewed_at, job_postings!inner(title)
    `)
    .in('id', applicationIds);

  const appMap = new Map(applications?.map((app) => [app.id, app]) || []);

  // Hämta media batch
  const profileMediaMap: Record<string, any> = {};
  const { data: batchMediaData } = await supabase.rpc('get_applicant_profile_media_batch', {
    p_applicant_ids: applicantIds,
    p_employer_id: userId,
  });

  if (batchMediaData) {
    batchMediaData.forEach((row: any) => {
      profileMediaMap[row.applicant_id] = {
        profile_image_url: row.profile_image_url,
        video_url: row.video_url,
        is_profile_video: row.is_profile_video,
        last_active_at: row.last_active_at,
      };
    });
  }

  // Hämta aktivitetsdata batch
  const activityMap: Record<string, any> = {};
  const { data: activityData } = await supabase.rpc('get_applicant_latest_activity', {
    p_applicant_ids: applicantIds,
    p_employer_id: userId,
  });

  if (activityData) {
    activityData.forEach((item: any) => {
      activityMap[item.applicant_id] = {
        latest_application_at: item.latest_application_at,
        last_active_at: item.last_active_at,
      };
    });
  }

  // Bygg items
  const items = myCandidates.map((mc) => {
    const app = appMap.get(mc.application_id);
    const media = profileMediaMap[mc.applicant_id] || {};
    const activity = activityMap[mc.applicant_id] || {};

    return {
      id: mc.id,
      recruiter_id: mc.recruiter_id,
      applicant_id: mc.applicant_id,
      application_id: mc.application_id,
      job_id: mc.job_id,
      stage: mc.stage,
      notes: mc.notes,
      rating: mc.rating,
      created_at: mc.created_at,
      updated_at: mc.updated_at,
      first_name: app?.first_name || null,
      last_name: app?.last_name || null,
      email: app?.email || null,
      phone: app?.phone || null,
      location: app?.location || null,
      bio: app?.bio || null,
      cv_url: app?.cv_url || null,
      age: app?.age || null,
      employment_status: app?.employment_status || null,
      work_schedule: app?.work_schedule || null,
      availability: app?.availability || null,
      custom_answers: app?.custom_answers || null,
      status: app?.status || null,
      applied_at: app?.applied_at || null,
      viewed_at: app?.viewed_at || null,
      job_title: (app as any)?.job_postings?.title || 'Okänt jobb',
      profile_image_url: media.profile_image_url || null,
      video_url: media.video_url || null,
      is_profile_video: media.is_profile_video || false,
      last_active_at: activity.last_active_at || media.last_active_at || null,
      latest_application_at: activity.latest_application_at || app?.applied_at,
    };
  });

  // Uppdatera React Query cache
  const existingData: any = queryClient.getQueryData(queryKey);
  const newTimestamps = items.map((i) => i.updated_at).join(',');
  const existingTimestamps = existingData?.pages?.[0]?.items?.map((i: any) => i.updated_at)?.join(',');

  if (newTimestamps !== existingTimestamps) {
    queryClient.setQueryData(queryKey, {
      pages: [{ items, nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].updated_at : null }],
      pageParams: [null],
    });
  }

  // Förladda bilder
  const imagePaths = items
    .map((i) => i.profile_image_url)
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .slice(0, 25);

  if (imagePaths.length > 0) {
    Promise.all(imagePaths.map((p) => prefetchMediaUrl(p, 'profile-image').catch(() => {}))).catch(() => {});
  }
}

/**
 * Synka stage-settings för instant Kanban-vy (ingen "default steg" flicker)
 */
async function syncStageSettings(userId: string, queryClient: ReturnType<typeof useQueryClient>) {
  const queryKey = ['stage-settings', userId];
  
  try {
    const { data: settings, error } = await supabase
      .from('user_stage_settings')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });
    
    if (error || !settings) return;
    
    // Uppdatera React Query cache
    queryClient.setQueryData(queryKey, settings);
    
    // Spara till localStorage för instant first paint nästa gång
    const cacheKey = STAGE_SETTINGS_CACHE_KEY + userId;
    localStorage.setItem(cacheKey, JSON.stringify({
      settings,
      timestamp: Date.now(),
    }));
  } catch (cacheError) {
    console.warn('Failed to cache stage settings:', cacheError);
  }
}

export default useCandidateBackgroundSync;
