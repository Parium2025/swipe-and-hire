import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { updateLastSyncTime } from '@/lib/draftUtils';
import { preloadWeatherLocation } from './useWeather';

const SAVED_JOBS_CACHE_KEY = 'job_seeker_saved_jobs_';
const MY_APPLICATIONS_CACHE_KEY = 'job_seeker_applications_';
const MESSAGES_CACHE_KEY = 'job_seeker_messages_';
const AVAILABLE_JOBS_CACHE_KEY = 'job_seeker_available_jobs_';
const CANDIDATE_INTERVIEWS_CACHE_KEY = 'job_seeker_interviews_';
const WEATHER_CACHE_KEY = 'parium_weather_data';
const WEATHER_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min (optimal for weather)
// Ingen CACHE_MAX_AGE - vi förlitar oss på realtime subscriptions istället för TTL

/**
 * 🚀 JOB SEEKER BACKGROUND SYNC ENGINE
 * 
 * Premium preloading för jobbsökare som triggas DIREKT vid:
 * 1. Login
 * 2. Första användarinteraktion
 * 3. Tab-focus efter inaktivitet
 * 
 * Håller ALL jobbsökardata färsk genom:
 * - Periodisk refresh var 5:e minut
 * - Omedelbar preload vid aktivitet
 * - Smart cache-validering
 * 
 * Synkar: Sparade jobb, Mina ansökningar, Meddelanden, Lediga jobb, Intervjuer
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
  const periodicRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Endast för jobbsökare
  const isJobSeeker = userRole?.role === 'job_seeker';

  // 🌤️ Validera väder-cache
  const isWeatherCacheValid = useCallback((): boolean => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!cached) return false;
      
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
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

  // 💾 Preload sparade jobb (alltid hämta färsk data - realtime synkar)
  const preloadSavedJobs = useCallback(async (userId: string) => {
    const cacheKey = SAVED_JOBS_CACHE_KEY + userId;

    const { data, error } = await supabase
      .from('saved_jobs')
      .select('job_id, created_at')
      .eq('user_id', userId);

    if (!error && data) {
      const jobIds = new Set(data.map(item => item.job_id));
      
      localStorage.setItem(cacheKey, JSON.stringify({
        jobIds: Array.from(jobIds),
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache för omedelbar användning
      queryClient.setQueryData(['saved-jobs', userId], jobIds);
    }
  }, [queryClient]);

  // 📋 Preload mina ansökningar (alltid hämta färsk data - realtime synkar)
  const preloadMyApplications = useCallback(async (userId: string) => {
    const cacheKey = MY_APPLICATIONS_CACHE_KEY + userId;

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        id,
        job_id,
        status,
        applied_at,
        created_at,
        job_postings (
          id,
          title,
          location,
          employment_type,
          workplace_city,
          workplace_county,
          is_active,
          created_at,
          expires_at,
          applications_count,
          profiles:employer_id (
            company_name,
            company_logo_url
          )
        )
      `)
      .eq('applicant_id', userId)
      .order('applied_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache
      queryClient.setQueryData(['my-applications', userId], data);
      
      // Bygg även applied-job-ids cache
      const appliedJobIds = new Set(data.map(app => app.job_id));
      queryClient.setQueryData(['applied-job-ids', userId], appliedJobIds);
    }
  }, [queryClient]);

  // 💬 Preload konversationer/meddelanden (alltid hämta färsk data - realtime synkar)
  const preloadMessages = useCallback(async (userId: string) => {
    const cacheKey = MESSAGES_CACHE_KEY + userId;

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
        created_at
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
      
      // Uppdatera även den nya konversationscachen för useConversations hooken
      try {
        localStorage.setItem('parium_conversations_cache', JSON.stringify({
          userId,
          conversations,
          timestamp: Date.now(),
        }));
      } catch {
        // Ignorera storage-fel
      }
    }
  }, [queryClient]);

  // 🏢 Preload lediga jobb (alltid hämta färsk data - realtime synkar)
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
        profiles:employer_id (
          company_name,
          company_logo_url
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache
      queryClient.setQueryData(['available-jobs'], data);
    }
  }, [queryClient]);

  // 📅 Preload kandidat-intervjuer (instant-load + background fetch)
  const preloadCandidateInterviews = useCallback(async (userId: string) => {
    const cacheKey = CANDIDATE_INTERVIEWS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    // STEG 1: Sätt React Query cache DIREKT från localStorage för instant rendering
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        // Populera React Query cache omedelbart (ingen TTL-kontroll - realtime synkar)
        if (parsed.items?.length >= 0) {
          queryClient.setQueryData(['candidate-interviews', userId], parsed.items);
        }
      } catch {
        // Korrupt cache - fortsätt till fetch
      }
    }

    // STEG 2: Hämta färsk data från servern (i bakgrunden)
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        *,
        job_postings(
          title,
          employer_id,
          profiles:employer_id(company_name, first_name, last_name)
        )
      `)
      .eq('applicant_id', userId)
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      // Spara till localStorage
      localStorage.setItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache med färsk data
      queryClient.setQueryData(['candidate-interviews', userId], data);
    }
  }, [queryClient]);

  // 🚀 HUVUDFUNKTION: Förladda ALL jobbsökardata parallellt
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
    const userId = user.id;

    try {
      // Kör alla preloads parallellt för maximal hastighet
      await Promise.all([
        preloadSavedJobs(userId),
        preloadMyApplications(userId),
        preloadMessages(userId),
        preloadAvailableJobs(),
        preloadCandidateInterviews(userId),
        preloadWeatherIfStale(),
      ]);

      hasPreloadedRef.current = true;
      // Uppdatera sync-tidsstämpel för offline-indikatorn
      updateLastSyncTime();
    } catch (error) {
      console.warn('[JobSeekerSync] Preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user, isJobSeeker, preloadSavedJobs, preloadMyApplications, preloadMessages, preloadAvailableJobs, preloadCandidateInterviews, preloadWeatherIfStale]);

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

  // 📡 Realtime ersätter periodisk refresh - ingen polling behövs

  // 🖱️ AKTIVITETS-TRIGGERS (OPTIMERAD FÖR TOUCH/SVAGT INTERNET)
  useEffect(() => {
    if (!user || !isJobSeeker) return;

    // 🚀 TOUCH OPTIMIZATION: Detect if we're on a touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 🌐 NETWORK OPTIMIZATION: Detect slow connection
    const isSlowConnection = () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return true;
        if (conn?.saveData) return true;
      }
      return false;
    };

    // 🚀 PERFORMANCE: Defer initial preload significantly on touch/slow
    const scheduleInitialPreload = () => {
      const delay = isTouchDevice || isSlowConnection() ? 3000 : 1000;
      
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => preloadAllData(), { timeout: delay });
      } else {
        setTimeout(() => preloadAllData(), delay);
      }
    };
    
    scheduleInitialPreload();

    // Lyssna på tab-focus - MED DEBOUNCE på touch
    let visibilityTimeout: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // På touch/svagt internet: vänta 2 sekunder innan sync
        const delay = isTouchDevice || isSlowConnection() ? 2000 : 0;
        
        if (visibilityTimeout) clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          hasPreloadedRef.current = false;
          // Använd requestIdleCallback för att inte blocka UI
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => preloadAllData(true), { timeout: 5000 });
          } else {
            preloadAllData(true);
          }
        }, delay);
      }
    };

    // På touch: INGEN omedelbar preload vid första interaktion (blockar touch response)
    // Desktop: behåll beteendet
    let firstInteractionHandled = false;
    const handleFirstInteraction = () => {
      if (firstInteractionHandled || isTouchDevice) return; // Skip på touch
      firstInteractionHandled = true;
      
      // Defer till idle
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => preloadAllData(), { timeout: 2000 });
      } else {
        setTimeout(() => preloadAllData(), 500);
      }
      
      document.removeEventListener('mousemove', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Endast desktop-interaktioner
    if (!isTouchDevice) {
      document.addEventListener('mousemove', handleFirstInteraction, { once: true });
      document.addEventListener('click', handleFirstInteraction, { once: true });
      document.addEventListener('keydown', handleFirstInteraction, { once: true });
    }

    return () => {
      if (visibilityTimeout) clearTimeout(visibilityTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [user, isJobSeeker, preloadAllData]);

  // 📡 REALTIME SUBSCRIPTIONS
  useEffect(() => {
    if (!user || !isJobSeeker) return;

    // Realtime för sparade jobb
    const savedJobsChannel = supabase
      .channel(`job-seeker-saved-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_jobs',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          preloadSavedJobs(user.id);
        }
      )
      .subscribe();

    // Realtime för ansökningar
    const applicationsChannel = supabase
      .channel(`job-seeker-applications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `applicant_id=eq.${user.id}`
        },
        () => {
          preloadMyApplications(user.id);
        }
      )
      .subscribe();

    // Realtime för meddelanden
    const messagesChannel = supabase
      .channel(`job-seeker-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        }
      )
      .subscribe();

    // Realtime för nya jobb (så jobbsökare ser nya annonser direkt)
    const newJobsChannel = supabase
      .channel('job-seeker-new-jobs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_postings',
        },
        () => {
          // Force refresh available jobs cache
          localStorage.removeItem(AVAILABLE_JOBS_CACHE_KEY);
          preloadAvailableJobs();
          queryClient.invalidateQueries({ queryKey: ['available-jobs'] });
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
      )
      .subscribe();

    // Realtime för intervjuer (bokade intervjuer för kandidaten)
    const interviewsChannel = supabase
      .channel(`job-seeker-interviews-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `applicant_id=eq.${user.id}`
        },
        () => {
          preloadCandidateInterviews(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(savedJobsChannel);
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(newJobsChannel);
      supabase.removeChannel(interviewsChannel);
    };
  }, [user, isJobSeeker, preloadSavedJobs, preloadMyApplications, preloadAvailableJobs, preloadCandidateInterviews, queryClient]);
};

export default useJobSeekerBackgroundSync;
