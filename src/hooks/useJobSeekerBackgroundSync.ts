import { useEffect, useRef, useCallback } from 'react';
import { safeSetItem } from '@/lib/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isOwnedJobSeekerRole } from '@/lib/roleOwnership';
import { useQueryClient } from '@tanstack/react-query';
import { updateLastSyncTime } from '@/lib/draftUtils';
import { preloadWeatherLocation } from './useWeather';
import { getCachedWeather } from '@/lib/weatherApi';

const AVAILABLE_JOBS_CACHE_KEY = 'job_seeker_available_jobs_';
const WEATHER_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min (optimal for weather)
// 🔒 SKALA: warmup av annonslistan får inte köras vid varje tabbfokus. Med
// 250 000 klienter blir varje fokusvåg en herd mot job_postings. Cachen anses
// färsk i 5 minuter; endast en explicit trigger (login/manuell) forcerar.
const AVAILABLE_JOBS_CACHE_MAX_AGE = 5 * 60 * 1000;

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
  // 🔒 Dedupe är ägarbunden OCH provider-lokal: A:s warmup får aldrig kväva
  // B:s första warmup vid ett kontobyte inom 2 sekunder.
  const lastPreloadRef = useRef<{ ownerId: string | null; ts: number }>({ ownerId: null, ts: 0 });
  // En explicit forcerad preload som kommer medan en körning pågår tappas inte —
  // den koalesceras till EN uppföljning efter den pågående körningen.
  const pendingForcedRef = useRef(false);
  const mountedRef = useRef(true);
  const preloadAllDataRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingForcedRef.current = false;
    };
  }, []);

  // Endast för jobbsökare — och endast när rollen bevisligen tillhör exakt den
  // inloggade användaren (en kvarhängande roll från konto A får inte köra
  // warmup för konto B).
  const isJobSeeker = isOwnedJobSeekerRole(user, userRole);

  // 🌤️ Validera väder-cache
  const isWeatherCacheValid = useCallback((): boolean => {
    try {
      const cached = getCachedWeather();
      if (!cached) return false;

      const age = Date.now() - cached.timestamp;
      // En framtida tidsstämpel (klockskev/manipulerad cache) är INTE färsk.
      return age >= 0 && age < WEATHER_CACHE_MAX_AGE;
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

  // 🏢 Läs den cachade annonslistan om den är färsk nog att hoppa över hämtningen.
  // Exception-safe och fail-closed: trasig/blockerad storage eller data som
  // tillhör ett annat konto betyder "inte färsk".
  const readFreshAvailableJobs = useCallback((ownerId: string | null): unknown[] | null => {
    try {
      const raw = localStorage.getItem(AVAILABLE_JOBS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { items?: unknown; timestamp?: unknown; ownerId?: unknown };
      if (!parsed || !Array.isArray(parsed.items) || typeof parsed.timestamp !== 'number') {
        return null;
      }
      if (typeof parsed.ownerId === 'string' && parsed.ownerId !== ownerId) return null;
      const age = Date.now() - parsed.timestamp;
      if (age < 0 || age >= AVAILABLE_JOBS_CACHE_MAX_AGE) return null;
      return parsed.items;
    } catch {
      return null;
    }
  }, []);

  // 🏢 Preload lediga jobb (enda datalistan denna hook äger)
  const preloadAvailableJobs = useCallback(async (force = false, ownerId: string | null = null) => {
    const cacheKey = AVAILABLE_JOBS_CACHE_KEY;

    if (!force) {
      const cachedItems = readFreshAvailableJobs(ownerId);
      console.log('DBG cacheCheck', ownerId, JSON.stringify(cachedItems), localStorage.getItem(AVAILABLE_JOBS_CACHE_KEY)?.slice(0,120));
      if (cachedItems) {
        // Färsk cache — ingen onödig read, men React Query MÅSTE hydreras,
        // annars visar Home tom lista trots giltig cache.
        queryClient.setQueryData(['available-jobs'], cachedItems);
        return;
      }
    }

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
        ownerId,
      }));

      // Uppdatera React Query cache
      queryClient.setQueryData(['available-jobs'], data);
    }
  }, [queryClient, readFreshAvailableJobs]);

  // 🚀 HUVUDFUNKTION: warmup av lediga jobb + väder
  // Uses requestIdleCallback to avoid blocking CSS transitions (sidebar, navigation)
  const preloadAllData = useCallback(async (force = false) => {
    console.log('DBG preloadAllData', user?.id, isJobSeeker);
    if (!user || !isJobSeeker) return;
    const ownerId = user.id;

    // Undvik dubbla preloads (inom 2 sekunder) — men endast för samma ägare.
    const now = Date.now();
    const last = lastPreloadRef.current;
    if (!force && last.ownerId === ownerId && now - last.ts >= 0 && now - last.ts < 2000) {
      return;
    }

    if (isPreloadingRef.current) {
      // Single-flight: forcerade triggers koalesceras till en uppföljning.
      if (force) pendingForcedRef.current = true;
      return;
    }

    isPreloadingRef.current = true;
    lastPreloadRef.current = { ownerId, ts: now };

    try {
      await Promise.all([
        preloadAvailableJobs(force, ownerId),
        preloadWeatherIfStale(),
      ]);

      hasPreloadedRef.current = true;
      // Tidsstämpel för senaste warmup-försöket (annonslista + väder).
      // Det är INTE en full datasynk — saved/apps/meddelanden/intervjuer ägs
      // av sina egna hookar.
      updateLastSyncTime();
    } catch (error) {
      console.warn('[JobSeekerSync] Preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
      if (pendingForcedRef.current) {
        pendingForcedRef.current = false;
        if (mountedRef.current) {
          await preloadAllDataRef.current?.(true);
        }
      }
    }
  }, [user, isJobSeeker, preloadAvailableJobs, preloadWeatherIfStale]);

  preloadAllDataRef.current = preloadAllData;

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
    // Tabbfokus forcerar INTE längre: cache-färskheten avgör om en read behövs.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hasPreloadedRef.current = false;
        schedulePreload();
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
