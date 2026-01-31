import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { updateLastSyncTime } from '@/lib/draftUtils';

const JOBS_CACHE_KEY = 'parium_employer_jobs_';
const INTERVIEWS_CACHE_KEY = 'parium_employer_interviews_';
const MY_CANDIDATES_CACHE_KEY = 'parium_my_candidates_';
const CONVERSATIONS_CACHE_KEY = 'parium_conversations_cache';
const ORG_QUESTIONS_CACHE_KEY = 'parium_org_questions_';
const CACHE_MAX_AGE = 3 * 60 * 1000; // 3 min
const PERIODIC_REFRESH_INTERVAL = 3 * 60 * 1000; // 3 min

/**
 * 🚀 EMPLOYER BACKGROUND SYNC ENGINE
 * 
 * Premium preloading för arbetsgivare som triggas DIREKT vid:
 * 1. Login
 * 2. Första användarinteraktion
 * 3. Tab-focus efter inaktivitet
 * 
 * Synkar: Mina jobb, Intervjuer, Mina kandidater, Meddelanden
 */

// Global state för att kunna trigga från useAuth vid login
let globalEmployerPreloadFunction: (() => Promise<void>) | null = null;
let lastEmployerPreloadTimestamp = 0;

/**
 * Trigga bakgrundssynk för arbetsgivare
 */
export const triggerEmployerBackgroundSync = async () => {
  if (globalEmployerPreloadFunction) {
    await globalEmployerPreloadFunction();
  }
};

export const useEmployerBackgroundSync = () => {
  const { user, userRole, profile } = useAuth();
  const queryClient = useQueryClient();
  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);
  const periodicRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Endast för arbetsgivare
  const isEmployer = userRole?.role === 'employer';

  // 📋 Preload arbetsgivarens jobb
  const preloadJobs = useCallback(async (userId: string, orgId: string | null) => {
    const cacheKey = JOBS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE && parsed.scope === 'personal' && parsed.orgId === orgId) {
          return; // Cache är färsk
        }
      } catch {
        // Korrupt cache - fortsätt
      }
    }

    const { data, error } = await supabase
      .from('job_postings')
      .select(`
        *,
        employer_profile:profiles!job_postings_employer_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq('employer_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      localStorage.setItem(cacheKey, JSON.stringify({
        jobs: data,
        scope: 'personal',
        orgId,
        timestamp: Date.now(),
      }));
      
      queryClient.setQueryData(['jobs', 'personal', orgId, userId], data);
    }
  }, [queryClient]);

  // 📅 Preload arbetsgivarens intervjuer
  const preloadInterviews = useCallback(async (userId: string) => {
    const cacheKey = INTERVIEWS_CACHE_KEY + userId;
    const existingCache = localStorage.getItem(cacheKey);
    
    if (existingCache) {
      try {
        const parsed = JSON.parse(existingCache);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_MAX_AGE) {
          // Populera React Query cache direkt
          queryClient.setQueryData(['interviews', userId], parsed.interviews);
          return;
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
      const result = data.map((interview: any) => ({
        ...interview,
        candidate_name: interview.job_applications 
          ? `${interview.job_applications.first_name || ''} ${interview.job_applications.last_name || ''}`.trim() || 'Okänd'
          : 'Okänd',
        job_title: interview.job_postings?.title || 'Okänd tjänst',
      }));

      localStorage.setItem(cacheKey, JSON.stringify({
        interviews: result,
        timestamp: Date.now(),
      }));
      
      queryClient.setQueryData(['interviews', userId], result);
    }
  }, [queryClient]);

  // 👥 Preload mina kandidater (första 100)
  const preloadMyCandidates = useCallback(async (userId: string) => {
    const cacheKey = MY_CANDIDATES_CACHE_KEY + userId;
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

    // Hämta mina kandidater
    const { data: myCandidates, error } = await supabase
      .from('my_candidates')
      .select('*')
      .eq('recruiter_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (!error && myCandidates && myCandidates.length > 0) {
      // Hämta application-data
      const applicationIds = myCandidates.map(mc => mc.application_id);
      const { data: applications } = await supabase
        .from('job_applications')
        .select(`
          id, applicant_id, first_name, last_name, email, phone, location, bio,
          cv_url, status, applied_at, job_postings!inner(title)
        `)
        .in('id', applicationIds);

      const appMap = new Map(applications?.map(app => [app.id, app]) || []);

      const items = myCandidates.map(mc => {
        const app = appMap.get(mc.application_id);
        return {
          id: mc.id,
          recruiter_id: mc.recruiter_id,
          applicant_id: mc.applicant_id,
          application_id: mc.application_id,
          job_id: mc.job_id,
          stage: mc.stage,
          notes: mc.notes,
          rating: mc.rating || 0,
          created_at: mc.created_at,
          updated_at: mc.updated_at,
          first_name: app?.first_name || null,
          last_name: app?.last_name || null,
          email: app?.email || null,
          phone: app?.phone || null,
          location: app?.location || null,
          bio: app?.bio || null,
          cv_url: app?.cv_url || null,
          status: app?.status || 'pending',
          job_title: (app?.job_postings as any)?.title || null,
          applied_at: app?.applied_at || null,
        };
      });

      localStorage.setItem(cacheKey, JSON.stringify({
        items,
        timestamp: Date.now(),
      }));
    }
  }, []);

  // 💬 Preload konversationer
  const preloadConversations = useCallback(async (userId: string) => {
    try {
      const cached = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.userId === userId) {
          const age = Date.now() - parsed.timestamp;
          if (age < CACHE_MAX_AGE) {
            queryClient.setQueryData(['conversations', userId], parsed.conversations);
            return;
          }
        }
      }
    } catch {
      // Continue to fetch
    }

    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) return;

    const conversationIds = memberships.map(m => m.conversation_id);
    
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`*, job:job_id (title)`)
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50);

    if (!error && conversations) {
      localStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify({
        userId,
        conversations,
        timestamp: Date.now(),
      }));
      
      queryClient.setQueryData(['conversations', userId], conversations);
    }
  }, [queryClient]);

  // 🚀 HUVUDFUNKTION: Förladda ALL arbetsgivardata parallellt
  const preloadAllData = useCallback(async (force = false) => {
    if (!user || !isEmployer) return;
    
    // Undvik dubbla preloads (inom 2 sekunder)
    const now = Date.now();
    if (!force && now - lastEmployerPreloadTimestamp < 2000) {
      return;
    }
    
    if (isPreloadingRef.current) return;
    
    isPreloadingRef.current = true;
    lastEmployerPreloadTimestamp = now;
    const userId = user.id;
    const orgId = profile?.organization_id || null;

    try {
      // Kör alla preloads parallellt för maximal hastighet
      await Promise.all([
        preloadJobs(userId, orgId),
        preloadInterviews(userId),
        preloadMyCandidates(userId),
        preloadConversations(userId),
      ]);

      hasPreloadedRef.current = true;
      updateLastSyncTime();
    } catch (error) {
      console.warn('[EmployerSync] Preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [user, isEmployer, profile?.organization_id, preloadJobs, preloadInterviews, preloadMyCandidates, preloadConversations]);

  // Exponera preload-funktionen globalt
  useEffect(() => {
    if (user && isEmployer) {
      globalEmployerPreloadFunction = () => preloadAllData(true);
    } else {
      globalEmployerPreloadFunction = null;
    }
    
    return () => {
      globalEmployerPreloadFunction = null;
    };
  }, [user, isEmployer, preloadAllData]);

  // 🔄 PERIODISK REFRESH
  useEffect(() => {
    if (!user || !isEmployer) {
      if (periodicRefreshRef.current) {
        clearInterval(periodicRefreshRef.current);
        periodicRefreshRef.current = null;
      }
      return;
    }

    periodicRefreshRef.current = setInterval(() => {
      preloadAllData(true);
    }, PERIODIC_REFRESH_INTERVAL);

    return () => {
      if (periodicRefreshRef.current) {
        clearInterval(periodicRefreshRef.current);
        periodicRefreshRef.current = null;
      }
    };
  }, [user, isEmployer, preloadAllData]);

  // 🖱️ AKTIVITETS-TRIGGERS
  useEffect(() => {
    if (!user || !isEmployer) return;

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
  }, [user, isEmployer, preloadAllData]);

  // 📡 REALTIME SUBSCRIPTIONS
  useEffect(() => {
    if (!user || !isEmployer) return;

    // Realtime för jobb
    const jobsChannel = supabase
      .channel(`employer-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_postings',
          filter: `employer_id=eq.${user.id}`
        },
        () => {
          preloadJobs(user.id, profile?.organization_id || null);
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
      )
      .subscribe();

    // Realtime för intervjuer
    const interviewsChannel = supabase
      .channel(`employer-interviews-sync-${user.id}`)
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

    // Realtime för mina kandidater
    const candidatesChannel = supabase
      .channel(`employer-candidates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'my_candidates',
          filter: `recruiter_id=eq.${user.id}`
        },
        () => {
          // Bara invalidera - snapshot-cachen hanteras av useMyCandidatesData
          queryClient.invalidateQueries({ queryKey: ['my-candidates', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(interviewsChannel);
      supabase.removeChannel(candidatesChannel);
    };
  }, [user, isEmployer, profile?.organization_id, preloadJobs, preloadInterviews, queryClient]);
};

export default useEmployerBackgroundSync;
