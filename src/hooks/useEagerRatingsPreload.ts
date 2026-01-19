import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { preloadWeatherLocation } from './useWeather';
import { useQueryClient } from '@tanstack/react-query';

const RATINGS_CACHE_PREFIX = 'ratings_cache_';
const STAGE_SETTINGS_CACHE_KEY = 'stage_settings_cache_';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const APPLICATIONS_SNAPSHOT_PREFIX = 'applications_snapshot_';
const JOBS_CACHE_KEY = 'jobs_snapshot_';
const CONVERSATIONS_CACHE_KEY = 'conversations_snapshot_';
const INTERVIEWS_CACHE_KEY = 'interviews_snapshot_';
const JOB_TEMPLATES_CACHE_KEY = 'job_templates_snapshot_';
const SNAPSHOT_EXPIRY_MS = 30 * 60 * 1000; // 30 min
const WEATHER_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min
const PERIODIC_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min - refresh all data periodically

interface RatingsCacheData {
  ratings: Record<string, number>;
  timestamp: number;
}

/**
 * 🚀 BACKGROUND SYNC ENGINE
 * 
 * Premium preloading som triggas DIREKT vid:
 * 1. Login (via triggerBackgroundSync export)
 * 2. Första användarinteraktion (musrörelse, klick, touch)
 * 3. Tab-focus efter inaktivitet
 * 
 * Håller ALL data färsk genom:
 * - Periodisk refresh var 5:e minut
 * - Omedelbar preload vid aktivitet
 * - Smart cache-validering (ignorerar gammal data)
 * 
 * Synkar: Väder, Betyg, Stage-settings, Kandidat-snapshots, Jobbannonser, Meddelanden, Intervjuer, Jobbmallar
 */

// Global state för att kunna trigga från useAuth vid login
let globalPreloadFunction: (() => Promise<void>) | null = null;
let lastPreloadTimestamp = 0;

/**
 * Trigga bakgrundssynk - anropas från useAuth vid login
 */
export const triggerBackgroundSync = async () => {
  if (globalPreloadFunction) {
    await globalPreloadFunction();
  }
};

/**
 * Validera väder-cache - returnerar true om cachen är giltig (under 5 min)
 */
const isWeatherCacheValid = (): boolean => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return false;
    
    const parsed = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;
    return age < WEATHER_CACHE_MAX_AGE;
  } catch {
    return false;
  }
};

export const useEagerRatingsPreload = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);
  const periodicRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Preload väder - ALLTID om cache är gammal eller saknas
  const preloadWeatherIfStale = useCallback(async () => {
    if (isWeatherCacheValid()) {
      return; // Cache är färsk - skippa
    }
    
    try {
      await preloadWeatherLocation();
    } catch (error) {
      console.warn('[BackgroundSync] Weather preload failed:', error);
    }
  }, []);

  // Preload ratings och stage-settings
  const preloadRatingsAndStages = useCallback(async (userId: string) => {
    // Kolla om cache är fräsch (under 5 min) - skippa då
    const existingCache = localStorage.getItem(RATINGS_CACHE_PREFIX + userId);
    let shouldFetchRatings = true;
    
    if (existingCache) {
      try {
        const parsed: RatingsCacheData = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < WEATHER_CACHE_MAX_AGE && Object.keys(parsed.ratings).length > 0) {
          shouldFetchRatings = false;
        }
      } catch {
        // Korrupt cache - fortsätt med preload
      }
    }

    if (shouldFetchRatings) {
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('candidate_ratings')
        .select('applicant_id, rating')
        .eq('recruiter_id', userId);

      if (!ratingsError && ratingsData) {
        const ratingsMap: Record<string, number> = {};
        ratingsData.forEach((row) => {
          ratingsMap[row.applicant_id] = row.rating;
        });

        if (Object.keys(ratingsMap).length > 0) {
          localStorage.setItem(RATINGS_CACHE_PREFIX + userId, JSON.stringify({
            ratings: ratingsMap,
            timestamp: Date.now()
          }));
        }
      }
    }

    // Hämta stage-settings också (för Kanban-vy utan flicker)
    const existingStageCache = localStorage.getItem(STAGE_SETTINGS_CACHE_KEY + userId);
    let shouldFetchStages = true;
    
    if (existingStageCache) {
      try {
        const parsed = JSON.parse(existingStageCache);
        const age = Date.now() - parsed.timestamp;
        if (age < WEATHER_CACHE_MAX_AGE) {
          shouldFetchStages = false;
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    if (shouldFetchStages) {
      const { data: stageSettings, error: stageError } = await supabase
        .from('user_stage_settings')
        .select('*')
        .eq('user_id', userId)
        .order('order_index', { ascending: true });

      if (!stageError && stageSettings) {
        localStorage.setItem(STAGE_SETTINGS_CACHE_KEY + userId, JSON.stringify({
          settings: stageSettings,
          timestamp: Date.now()
        }));
      }
    }
  }, []);

  // Preload kandidat-snapshot (första 50 kandidater)
  // Inkluderar nu betyg direkt i snapshot för att eliminera "millisekund-popin" i /candidates.
  const preloadCandidateSnapshot = useCallback(async (userId: string) => {
    const snapshotKey = APPLICATIONS_SNAPSHOT_PREFIX + userId;
    const existingSnapshot = localStorage.getItem(snapshotKey);

    // 1) Om snapshot redan finns och är färsk: patcha in betyg från ratings-cache och returnera.
    //    (Viktigt eftersom tidigare versioner sparade snapshot UTAN rating.)
    if (existingSnapshot) {
      try {
        const parsed = JSON.parse(existingSnapshot);
        const age = Date.now() - parsed.timestamp;

        if (age < SNAPSHOT_EXPIRY_MS && parsed.items?.length > 0) {
          try {
            const rawRatings = localStorage.getItem(RATINGS_CACHE_PREFIX + userId);
            if (rawRatings) {
              const ratingsCache: RatingsCacheData = JSON.parse(rawRatings);
              const ratings = ratingsCache?.ratings || {};

              if (Object.keys(ratings).length > 0) {
                let changed = false;
                const patchedItems = (parsed.items as any[]).map((item: any) => {
                  const nextRating = ratings[item.applicant_id] ?? item.rating ?? null;
                  if (item.rating !== nextRating) changed = true;
                  return { ...item, rating: nextRating };
                });

                if (changed) {
                  localStorage.setItem(
                    snapshotKey,
                    JSON.stringify({
                      items: patchedItems,
                      timestamp: Date.now(),
                    })
                  );
                }
              }
            }
          } catch {
            // ignore cache parse errors
          }

          return;
        }
      } catch {
        // Korrupt snapshot - fortsätt med ny preload
      }
    }

    // 2) Hämta första 50 kandidater
    const { data: baseData, error } = await supabase
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
      .range(0, 49);

    if (error || !baseData) return;

    const applicantIds = [...new Set(baseData.map((item: any) => item.applicant_id).filter(Boolean))] as string[];

    // 3) Hämta betyg för dessa 50 (snabb batch) och uppdatera ratings-cache
    const ratingsMap: Record<string, number> = {};

    // Seed från befintlig cache (om den finns)
    try {
      const raw = localStorage.getItem(RATINGS_CACHE_PREFIX + userId);
      if (raw) {
        const cache: RatingsCacheData = JSON.parse(raw);
        Object.assign(ratingsMap, cache?.ratings || {});
      }
    } catch {
      // ignore
    }

    if (navigator.onLine && applicantIds.length > 0) {
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('candidate_ratings')
        .select('applicant_id, rating')
        .eq('recruiter_id', userId)
        .in('applicant_id', applicantIds);

      if (!ratingsError && ratingsData) {
        ratingsData.forEach((row: any) => {
          ratingsMap[row.applicant_id] = row.rating;
        });

        // Spara cache även här så /candidates kan merge:a direkt i readSnapshot
        try {
          localStorage.setItem(
            RATINGS_CACHE_PREFIX + userId,
            JSON.stringify({ ratings: ratingsMap, timestamp: Date.now() })
          );
        } catch {
          // ignore
        }
      }
    }

    // 4) Bygg items med job_title + rating
    const items = baseData.map((item: any) => ({
      ...item,
      job_title: item.job_postings?.title || 'Okänt jobb',
      job_occupation: item.job_postings?.occupation || null,
      rating: ratingsMap[item.applicant_id] ?? null,
      job_postings: undefined,
    }));

    // 5) Spara snapshot
    localStorage.setItem(
      snapshotKey,
      JSON.stringify({
        items,
        timestamp: Date.now(),
      })
    );
  }, []);

  // 📋 Preload jobbannonser (för dashboard stats + My Jobs)
  const preloadJobPostings = useCallback(async (userId: string, organizationId?: string | null) => {
    const cacheKey = JOBS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < WEATHER_CACHE_MAX_AGE && parsed.items?.length >= 0) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    // Hämta jobbannonser
    let query = supabase
      .from('job_postings')
      .select('id, title, is_active, views_count, applications_count, created_at, expires_at, location, employment_type, employer_id')
      .order('created_at', { ascending: false });

    // Om del av organisation, hämta alla org-jobb
    if (organizationId) {
      const { data: orgMembers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      
      if (orgMembers && orgMembers.length > 0) {
        const memberIds = orgMembers.map(m => m.user_id);
        query = query.in('employer_id', memberIds);
      } else {
        query = query.eq('employer_id', userId);
      }
    } else {
      query = query.eq('employer_id', userId);
    }

    const { data, error } = await query.limit(100);
    
    if (!error && data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache också för omedelbar användning
      queryClient.setQueryData(['jobs', 'all', organizationId, userId], data);
    }
  }, [queryClient]);

  // 💬 Preload konversationer/meddelanden
  const preloadConversations = useCallback(async (userId: string) => {
    const cacheKey = CONVERSATIONS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < WEATHER_CACHE_MAX_AGE && parsed.items?.length >= 0) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    // Hämta konversationer där användaren är medlem
    const { data: memberData } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (!memberData || memberData.length === 0) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: [],
        timestamp: Date.now(),
      }));
      return;
    }

    const conversationIds = memberData.map(m => m.conversation_id);
    
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        name,
        is_group,
        job_id,
        last_message_at,
        created_at,
        conversation_members!inner(user_id, last_read_at)
      `)
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50);

    if (!error && conversations) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: conversations,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache
      queryClient.setQueryData(['conversations', userId], conversations);
    }
  }, [queryClient]);

  // 📅 Preload intervjuer (kommande bokade intervjuer)
  const preloadInterviews = useCallback(async (userId: string) => {
    const cacheKey = INTERVIEWS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < WEATHER_CACHE_MAX_AGE && parsed.items?.length >= 0) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    const { data, error } = await supabase
      .from('interviews')
      .select(`
        *,
        job_postings(title),
        job_applications(first_name, last_name)
      `)
      .eq('employer_id', userId)
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      const items = data.map((interview: any) => ({
        ...interview,
        candidate_name: interview.job_applications 
          ? `${interview.job_applications.first_name || ''} ${interview.job_applications.last_name || ''}`.trim() || 'Okänd'
          : 'Okänd',
        job_title: interview.job_postings?.title || 'Okänd tjänst',
      }));

      localStorage.setItem(cacheKey, JSON.stringify({
        items,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache
      queryClient.setQueryData(['interviews', userId], items);
    }
  }, [queryClient]);

  // 📋 Preload jobbmallar
  const preloadJobTemplates = useCallback(async (userId: string) => {
    const cacheKey = JOB_TEMPLATES_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < WEATHER_CACHE_MAX_AGE && parsed.items?.length >= 0) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    const { data, error } = await supabase
      .from('job_templates')
      .select('*')
      .eq('employer_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache
      queryClient.setQueryData(['job-templates', userId], data);
    }
  }, [queryClient]);

  // 🚀 HUVUDFUNKTION: Förladda ALL data parallellt
  const preloadAllData = useCallback(async (force = false) => {
    if (!user) return;
    
    // Undvik dubbla preloads (inom 2 sekunder)
    const now = Date.now();
    if (!force && now - lastPreloadTimestamp < 2000) {
      return;
    }
    
    if (isPreloadingRef.current) return;
    
    isPreloadingRef.current = true;
    lastPreloadTimestamp = now;
    const userId = user.id;

    try {
      // Kör alla preloads parallellt för maximal hastighet
      await Promise.all([
        preloadRatingsAndStages(userId),
        preloadWeatherIfStale(),
        preloadCandidateSnapshot(userId),
        preloadJobPostings(userId, profile?.organization_id),
        preloadConversations(userId),
        preloadInterviews(userId),
        preloadJobTemplates(userId),
      ]);

      hasPreloadedRef.current = true;
    } catch (error) {
      console.warn('[BackgroundSync] Preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user, profile, preloadRatingsAndStages, preloadWeatherIfStale, preloadCandidateSnapshot, preloadJobPostings, preloadConversations, preloadInterviews, preloadJobTemplates]);

  // Exponera preload-funktionen globalt så useAuth kan trigga den vid login
  useEffect(() => {
    if (user) {
      globalPreloadFunction = () => preloadAllData(true);
    } else {
      globalPreloadFunction = null;
    }
    
    return () => {
      globalPreloadFunction = null;
    };
  }, [user, preloadAllData]);

  // 🔄 PERIODISK REFRESH: Håll all data färsk var 5:e minut
  useEffect(() => {
    if (!user) {
      if (periodicRefreshRef.current) {
        clearInterval(periodicRefreshRef.current);
        periodicRefreshRef.current = null;
      }
      return;
    }

    // Starta periodisk refresh
    periodicRefreshRef.current = setInterval(() => {
      preloadAllData(true); // Force refresh
    }, PERIODIC_REFRESH_INTERVAL);

    return () => {
      if (periodicRefreshRef.current) {
        clearInterval(periodicRefreshRef.current);
        periodicRefreshRef.current = null;
      }
    };
  }, [user, preloadAllData]);

  useEffect(() => {
    if (!user) return;

    // Kör preload DIREKT vid mount (användaren är redan aktiv om de är här)
    preloadAllData();

    // Lyssna på tab-focus (användare kommer tillbaka efter inaktivitet)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Alltid refresh vid tab-focus om cache är gammal
        hasPreloadedRef.current = false;
        preloadAllData(true);
      }
    };

    // Lyssna på första musrörelse/klick (användaren är aktiv)
    let firstInteractionHandled = false;
    const handleFirstInteraction = () => {
      if (firstInteractionHandled) return;
      firstInteractionHandled = true;
      preloadAllData();
      // Ta bort lyssnare efter första interaktion
      document.removeEventListener('mousemove', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [user, preloadAllData]);

  // 📡 REALTIME SUBSCRIPTIONS för employer
  useEffect(() => {
    if (!user) return;

    // Realtime för intervjuer
    const interviewsChannel = supabase
      .channel(`employer-interviews-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `employer_id=eq.${user.id}`
        },
        () => {
          preloadInterviews(user.id);
        }
      )
      .subscribe();

    // Realtime för jobbmallar
    const templatesChannel = supabase
      .channel(`employer-templates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_templates',
          filter: `employer_id=eq.${user.id}`
        },
        () => {
          preloadJobTemplates(user.id);
        }
      )
      .subscribe();

    // Realtime för stage-settings
    const stageSettingsChannel = supabase
      .channel(`employer-stage-settings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stage_settings',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          preloadRatingsAndStages(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(interviewsChannel);
      supabase.removeChannel(templatesChannel);
      supabase.removeChannel(stageSettingsChannel);
    };
  }, [user, preloadInterviews, preloadJobTemplates, preloadRatingsAndStages]);
};

export default useEagerRatingsPreload;
