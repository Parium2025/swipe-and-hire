import { useEffect, useRef, useCallback } from 'react';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { updateLastSyncTime } from '@/lib/draftUtils';
import { preloadWeatherLocation } from './useWeather';
import { getCachedWeather } from '@/lib/weatherApi';

const AVAILABLE_JOBS_CACHE_KEY = 'job_seeker_available_jobs_';
const WEATHER_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min (optimal for weather)

/**
 * 🚀 JOB SEEKER BACKGROUND SYNC ENGINE (warmup only)
 *
 * Denna hook äger ENDAST två saker:
 *  1. Warmup av listan med lediga jobb (`available-jobs`)
 *  2. Väderhämtning när väder-cachen är gammal
 *
 * 🔒 DATAÄGARSKAP (får INTE dupliceras här):
 *  - saved_jobs / job_applications → AuthProvider äger de användarfiltrerade
 *    realtime-lyssnarna; listorna hämtas av sina egna sidhookar.
 *  - konversationer/meddelanden → ConversationsProvider/useConversations äger
 *    både realtime och `parium_conversations_cache`.
 *  - intervjuer → useCandidateInterviews äger realtime och den kanoniska
 *    ['candidate-interviews', userId]-cachen.
 *
 * Tidigare läste och cachade denna hook samma data en gång till vid cold start,
 * första interaktion och varje tabbfokus. Det gav dubbla reads, trunkerade
 * cachar (max 50 ansökningar) och ofullständiga conversation-shapes som kunde
 * klobba den kanoniska cachen.
 */

// Global state för att kunna trigga från useAuth vid login
let globalJobSeekerPreloadFunction: (() => Promise<void>) | null = null;
let lastJobSeekerPreloadTimestamp = 0;

/**
 * Trigga bakgrundssynk för jobbsökare
 */
export const triggerJobSeekerBackgroundSync = async () => {
  if (globalJobSeekerPreloadFunction) {
    await globalJobSeekerPreloadFunction();
  }
};

export const useJobSeekerBackgroundSync = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);

  // Endast för jobbsökare
  const isJobSeeker = userRole?.role === 'job_seeker';

  // 🌤️ Validera väder-cache
  const isWeatherCacheValid = useCallback((): boolean => {
    try {
      const cached = getCachedWeather();
      if (!cached) return false;

      const age = Date.now() - cached.timestamp;
      return age < WEATHER_CACHE_MAX_AGE;
    } catch {
      return false;
    }
  }, []);

  // 🌤️ Preload väder om cache är gammal
  const preloadWeatherIfStale = useCallback(async () => {
    if (isWeatherCacheValid()) {
      return; // Cache är färsk
    }

    try {
      await preloadWeatherLocation();
    } catch (error) {
      console.warn('[JobSeekerSync] Weather preload failed:', error);
    }
  }, [isWeatherCacheValid]);

  // 🏢 Preload lediga jobb (enda datalistan denna hook äger)
  const preloadAvailableJobs = useCallback(async () => {
    const cacheKey = AVAILABLE_JOBS_CACHE_KEY;

    const { data, error } = await supabase
      .from('job_postings')
      .select(`
        id,
        title,
        location,
        employment_type,
        workplace_city,
        workplace_county,
        salary_min,
        salary_max,
        salary_type,
        salary_transparency,
        created_at,
        expires_at,
        is_active,
        job_image_url,
        workplace_name,
        company_logo_url,
        overlay_text_color
      `)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      safeSetItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));

      // Uppdatera React Query cache
      queryClient.setQueryData(['available-jobs'], data);
    }
  }, [queryClient]);

  // 🚀 HUVUDFUNKTION: warmup av lediga jobb + väder
  // Uses requestIdleCallback to avoid blocking CSS transitions (sidebar, navigation)
  const preloadAllData = useCallback(async (force = false) => {
    if (!user || !isJobSeeker) return;

    // Undvik dubbla preloads (inom 2 sekunder)
    const now = Date.now();
    if (!force && now - lastJobSeekerPreloadTimestamp < 2000) {
      return;
    }

    if (isPreloadingRef.current) return;

    isPreloadingRef.current = true;
    lastJobSeekerPreloadTimestamp = now;

    try {
      await Promise.all([
        preloadAvailableJobs(),
        preloadWeatherIfStale(),
      ]);

      hasPreloadedRef.current = true;
      updateLastSyncTime();
    } catch (error) {
      console.warn('[JobSeekerSync] Preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user, isJobSeeker, preloadAvailableJobs, preloadWeatherIfStale]);

  // 🕐 Schemalägg preload via requestIdleCallback så den ALDRIG blockerar animationer
  const schedulePreload = useCallback((force = false) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => preloadAllData(force), { timeout: 2000 });
    } else {
      // Fallback för Safari: kör efter nuvarande frame + micro-tasks
      setTimeout(() => preloadAllData(force), 50);
    }
  }, [preloadAllData]);

  // Exponera preload-funktionen globalt
  useEffect(() => {
    if (user && isJobSeeker) {
      globalJobSeekerPreloadFunction = () => preloadAllData(true);
    } else {
      globalJobSeekerPreloadFunction = null;
    }

    return () => {
      globalJobSeekerPreloadFunction = null;
    };
  }, [user, isJobSeeker, preloadAllData]);

  // 🖱️ AKTIVITETS-TRIGGERS (OPTIMERAD FÖR TOUCH/SVAGT INTERNET)
  useEffect(() => {
    if (!user || !isJobSeeker) return;

    // 🚀 Deferred: Preload data when browser is idle (not during initial paint)
    schedulePreload();

    // Tab-focus: sync when user returns, but deferred
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hasPreloadedRef.current = false;
        schedulePreload(true);
      }
    };

    // First interaction triggers sync — deferred to not block touch feedback
    let firstInteractionHandled = false;
    const handleFirstInteraction = () => {
      if (firstInteractionHandled) return;
      firstInteractionHandled = true;
      schedulePreload();
      document.removeEventListener('mousemove', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [user, isJobSeeker, schedulePreload]);

  // 📡 INGEN realtime här. Se ägarskapskommentaren överst: AuthProvider,
  // ConversationsProvider och useCandidateInterviews är kanoniska ägare.
  //
  // 📝 Känt, medvetet ej löst här: andra besökta KeepAlive-sidor med
  // display:none behåller sina egna sidlyssnare och refetchOnReconnect. Det
  // kräver per-sida-gating och ligger utanför denna Home-körning.
};

export default useJobSeekerBackgroundSync;
