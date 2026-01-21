import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';

const SAVED_JOBS_CACHE_KEY = 'job_seeker_saved_jobs_';
const MY_APPLICATIONS_CACHE_KEY = 'job_seeker_applications_';
const MESSAGES_CACHE_KEY = 'job_seeker_messages_';
const AVAILABLE_JOBS_CACHE_KEY = 'job_seeker_available_jobs_';
const CANDIDATE_INTERVIEWS_CACHE_KEY = 'job_seeker_interviews_';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min
const PERIODIC_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

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

  // 💾 Preload sparade jobb
  const preloadSavedJobs = useCallback(async (userId: string) => {
    const cacheKey = SAVED_JOBS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

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

  // 📋 Preload mina ansökningar
  const preloadMyApplications = useCallback(async (userId: string) => {
    const cacheKey = MY_APPLICATIONS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE && parsed.items?.length >= 0) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

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

  // 💬 Preload konversationer/meddelanden för jobbsökare
  const preloadMessages = useCallback(async (userId: string) => {
    const cacheKey = MESSAGES_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE) {
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
    }
  }, [queryClient]);

  // 🏢 Preload lediga jobb (första 100 för snabb rendering)
  const preloadAvailableJobs = useCallback(async () => {
    const cacheKey = AVAILABLE_JOBS_CACHE_KEY;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE && parsed.items?.length > 0) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
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

  // 📅 Preload kandidat-intervjuer (bokade intervjuer för jobbsökaren)
  const preloadCandidateInterviews = useCallback(async (userId: string) => {
    const cacheKey = CANDIDATE_INTERVIEWS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE && parsed.items?.length >= 0) {
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
        job_postings(title, employer_id),
        profiles!interviews_employer_id_fkey(company_name, first_name, last_name)
      `)
      .eq('applicant_id', userId)
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        items: data,
        timestamp: Date.now(),
      }));
      
      // Uppdatera React Query cache
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
      ]);

      hasPreloadedRef.current = true;
    } catch (error) {
      console.warn('[JobSeekerSync] Preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user, isJobSeeker, preloadSavedJobs, preloadMyApplications, preloadMessages, preloadAvailableJobs, preloadCandidateInterviews]);

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

  // 🔄 PERIODISK REFRESH: Håll all data färsk var 5:e minut
  useEffect(() => {
    if (!user || !isJobSeeker) {
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
  }, [user, isJobSeeker, preloadAllData]);

  // 🖱️ AKTIVITETS-TRIGGERS
  useEffect(() => {
    if (!user || !isJobSeeker) return;

    // Kör preload DIREKT vid mount
    preloadAllData();

    // Lyssna på tab-focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hasPreloadedRef.current = false;
        preloadAllData(true);
      }
    };

    // Lyssna på första musrörelse/klick
    let firstInteractionHandled = false;
    const handleFirstInteraction = () => {
      if (firstInteractionHandled) return;
      firstInteractionHandled = true;
      preloadAllData();
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
