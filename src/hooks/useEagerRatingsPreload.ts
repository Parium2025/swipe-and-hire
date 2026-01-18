import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const RATINGS_CACHE_PREFIX = 'ratings_cache_';
const STAGE_SETTINGS_CACHE_KEY = 'stage_settings_cache_';

interface RatingsCacheData {
  ratings: Record<string, number>;
  timestamp: number;
}

/**
 * Hook som förladddar ratings och stage-settings DIREKT vid första användaraktivitet.
 * 
 * Problemet: useCandidateBackgroundSync körs först när EmployerLayout monteras,
 * men om användaren varit inaktiv i 2 timmar och sen navigerar till /candidates
 * så är ratings-cachen tom → flicker där betyg syns efter millisekunder.
 * 
 * Lösningen: Lyssna på FÖRSTA användarinteraktion (tab-focus, musrörelse, klick)
 * och förladda ratings INNAN användaren hinner navigera.
 * 
 * Detta körs i EmployerLayout och triggas EN GÅNG per session.
 */
export const useEagerRatingsPreload = () => {
  const { user } = useAuth();
  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);

  const preloadRatings = useCallback(async () => {
    if (!user || hasPreloadedRef.current || isPreloadingRef.current) return;
    
    isPreloadingRef.current = true;
    const userId = user.id;

    try {
      // Kolla om cache är fräsch (under 5 min) - skippa då
      const existingCache = localStorage.getItem(RATINGS_CACHE_PREFIX + userId);
      if (existingCache) {
        try {
          const parsed: RatingsCacheData = JSON.parse(existingCache);
          const age = Date.now() - parsed.timestamp;
          if (age < 5 * 60 * 1000 && Object.keys(parsed.ratings).length > 0) {
            // Cache är fräsch - skippa preload
            hasPreloadedRef.current = true;
            isPreloadingRef.current = false;
            return;
          }
        } catch {
          // Korrupt cache - fortsätt med preload
        }
      }

      // Hämta alla ratings för denna användare
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('candidate_ratings')
        .select('applicant_id, rating')
        .eq('recruiter_id', userId);

      if (!ratingsError && ratingsData) {
        const ratingsMap: Record<string, number> = {};
        ratingsData.forEach((row) => {
          ratingsMap[row.applicant_id] = row.rating;
        });

        // Spara till localStorage
        if (Object.keys(ratingsMap).length > 0) {
          localStorage.setItem(RATINGS_CACHE_PREFIX + userId, JSON.stringify({
            ratings: ratingsMap,
            timestamp: Date.now()
          }));
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

      hasPreloadedRef.current = true;
    } catch (error) {
      console.warn('Eager ratings preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Kör preload DIREKT vid mount (användaren är redan aktiv om de är här)
    preloadRatings();

    // Lyssna på tab-focus (användare kommer tillbaka efter inaktivitet)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset hasPreloaded så vi kan preloada igen vid nästa tab-focus
        // (om det gått mer än 5 min sedan senaste preload)
        const existingCache = localStorage.getItem(RATINGS_CACHE_PREFIX + user.id);
        if (existingCache) {
          try {
            const parsed: RatingsCacheData = JSON.parse(existingCache);
            const age = Date.now() - parsed.timestamp;
            if (age > 5 * 60 * 1000) {
              hasPreloadedRef.current = false;
              preloadRatings();
            }
          } catch {
            hasPreloadedRef.current = false;
            preloadRatings();
          }
        } else {
          hasPreloadedRef.current = false;
          preloadRatings();
        }
      }
    };

    // Lyssna på första musrörelse/klick (användaren är aktiv)
    let firstInteractionHandled = false;
    const handleFirstInteraction = () => {
      if (firstInteractionHandled) return;
      firstInteractionHandled = true;
      preloadRatings();
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
  }, [user, preloadRatings]);
};

export default useEagerRatingsPreload;
