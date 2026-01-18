import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { preloadWeatherLocation } from './useWeather';

const RATINGS_CACHE_PREFIX = 'ratings_cache_';
const STAGE_SETTINGS_CACHE_KEY = 'stage_settings_cache_';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const APPLICATIONS_SNAPSHOT_PREFIX = 'applications_snapshot_';
const SNAPSHOT_EXPIRY_MS = 30 * 60 * 1000; // 30 min

interface RatingsCacheData {
  ratings: Record<string, number>;
  timestamp: number;
}

/**
 * Hook som förladddar ratings, stage-settings OCH väderdata DIREKT vid första användaraktivitet.
 * 
 * Problemet: useCandidateBackgroundSync körs först när EmployerLayout monteras,
 * men om användaren varit inaktiv i 2 timmar och sen navigerar till /candidates
 * så är ratings-cachen tom → flicker där betyg syns efter millisekunder.
 * Samma gäller väder - cachen går ut efter 5 min, så snö/regn flickrar.
 * 
 * Lösningen: Lyssna på FÖRSTA användarinteraktion (tab-focus, musrörelse, klick)
 * och förladda ratings + väder INNAN användaren hinner navigera.
 * 
 * Detta körs i EmployerLayout och triggas EN GÅNG per session.
 */
export const useEagerRatingsPreload = () => {
  const { user } = useAuth();
  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);

  // Preload väder om cache är gammal
  const preloadWeatherIfStale = useCallback(async () => {
    try {
      const existingWeather = localStorage.getItem(WEATHER_CACHE_KEY);
      if (existingWeather) {
        const parsed = JSON.parse(existingWeather);
        const age = Date.now() - parsed.timestamp;
        // Om cache är under 5 min - skippa
        if (age < 5 * 60 * 1000) {
          return;
        }
      }
      // Cache är gammal eller saknas - förladda väder
      await preloadWeatherLocation();
    } catch (error) {
      console.warn('Weather preload failed:', error);
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
        if (age < 5 * 60 * 1000 && Object.keys(parsed.ratings).length > 0) {
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
        if (age < 5 * 60 * 1000) {
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
  const preloadCandidateSnapshot = useCallback(async (userId: string) => {
    const snapshotKey = APPLICATIONS_SNAPSHOT_PREFIX + userId;
    const existingSnapshot = localStorage.getItem(snapshotKey);
    
    if (existingSnapshot) {
      try {
        const parsed = JSON.parse(existingSnapshot);
        const age = Date.now() - parsed.timestamp;
        // Om snapshot är under 30 min - skippa
        if (age < SNAPSHOT_EXPIRY_MS && parsed.items?.length > 0) {
          return;
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    // Hämta första 50 kandidater
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

    // Bygg items med job_title
    const items = baseData.map((item: any) => ({
      ...item,
      job_title: item.job_postings?.title || 'Okänt jobb',
      job_occupation: item.job_postings?.occupation || null,
      job_postings: undefined,
    }));

    // Spara snapshot
    localStorage.setItem(snapshotKey, JSON.stringify({
      items,
      timestamp: Date.now(),
    }));
  }, []);

  const preloadAllData = useCallback(async () => {
    if (!user || hasPreloadedRef.current || isPreloadingRef.current) return;
    
    isPreloadingRef.current = true;
    const userId = user.id;

    try {
      // Kör alla preloads parallellt för maximal hastighet
      await Promise.all([
        preloadRatingsAndStages(userId),
        preloadWeatherIfStale(),
        preloadCandidateSnapshot(userId),
      ]);

      hasPreloadedRef.current = true;
    } catch (error) {
      console.warn('Eager preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user, preloadRatingsAndStages, preloadWeatherIfStale, preloadCandidateSnapshot]);

  useEffect(() => {
    if (!user) return;

    // Kör preload DIREKT vid mount (användaren är redan aktiv om de är här)
    preloadAllData();

    // Lyssna på tab-focus (användare kommer tillbaka efter inaktivitet)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset hasPreloaded så vi kan preloada igen vid nästa tab-focus
        // (om det gått mer än 5 min sedan senaste preload)
        const existingCache = localStorage.getItem(RATINGS_CACHE_PREFIX + user.id);
        let shouldRefresh = true;
        
        if (existingCache) {
          try {
            const parsed: RatingsCacheData = JSON.parse(existingCache);
            const age = Date.now() - parsed.timestamp;
            if (age < 5 * 60 * 1000) {
              shouldRefresh = false;
            }
          } catch {
            // Korrupt cache - refresh
          }
        }
        
        if (shouldRefresh) {
          hasPreloadedRef.current = false;
          preloadAllData();
        }
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
};

export default useEagerRatingsPreload;
