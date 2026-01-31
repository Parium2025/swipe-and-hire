import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useOnline } from '@/hooks/useOnlineStatus';

const CACHE_KEY = 'parium_saved_jobs_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheData {
  jobIds: string[];
  userId: string;
  timestamp: number;
}

function loadFromCache(userId: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const data: CacheData = JSON.parse(raw);
    
    // Check if cache is valid (same user and not expired)
    if (data.userId !== userId) return null;
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    
    return new Set(data.jobIds);
  } catch {
    return null;
  }
}

function saveToCache(userId: string, jobIds: Set<string>): void {
  try {
    const data: CacheData = {
      jobIds: Array.from(jobIds),
      userId,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export const useSavedJobs = () => {
  const { user } = useAuth();
  const hasInitialized = useRef(false);
  
  // Initialize from cache immediately to prevent "fill-in" effect
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !user?.id) return new Set();
    return loadFromCache(user.id) || new Set();
  });
  
  // Only show loading if we don't have cached data
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === 'undefined' || !user?.id) return true;
    return loadFromCache(user.id) === null;
  });

  // Re-initialize from cache when user changes
  useEffect(() => {
    if (!user?.id) {
      setSavedJobIds(new Set());
      setIsLoading(false);
      return;
    }
    
    const cached = loadFromCache(user.id);
    if (cached) {
      setSavedJobIds(cached);
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchSavedJobs = useCallback(async () => {
    if (!user) {
      setSavedJobIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const newIds = new Set(data?.map(item => item.job_id) || []);
      setSavedJobIds(newIds);
      
      // Update cache with fresh data
      saveToCache(user.id, newIds);
    } catch (err) {
      console.error('Error fetching saved jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch saved job IDs on mount (background hydration)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    fetchSavedJobs();
  }, [fetchSavedJobs]);

  // Realtime-prenumeration för sparade jobb-uppdateringar
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`saved-jobs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_jobs',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchSavedJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSavedJobs]);

  const { isOnline, showOfflineToast } = useOnline();

  const toggleSaveJob = useCallback(async (jobId: string) => {
    if (!user) {
      toast.error('Du måste vara inloggad för att spara jobb');
      return;
    }

    if (!isOnline) {
      showOfflineToast();
      return;
    }

    const isSaved = savedJobIds.has(jobId);

    // Optimistic update
    setSavedJobIds(prev => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      // Update cache immediately for instant navigation
      saveToCache(user.id, next);
      return next;
    });

    try {
      if (isSaved) {
        // Remove from saved
        const { error } = await supabase
          .from('saved_jobs')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', jobId);

        if (error) throw error;
        toast.success('Jobb borttaget från sparade');
      } else {
        // Add to saved
        const { error } = await supabase
          .from('saved_jobs')
          .insert({ user_id: user.id, job_id: jobId });

        if (error) throw error;
        toast.success('Jobbet har sparats till dina favoriter');
      }
    } catch (err) {
      // Revert optimistic update on error
      setSavedJobIds(prev => {
        const next = new Set(prev);
        if (isSaved) {
          next.add(jobId);
        } else {
          next.delete(jobId);
        }
        // Revert cache
        saveToCache(user.id, next);
        return next;
      });
      console.error('Error toggling saved job:', err);
      toast.error('Kunde inte spara jobbet');
    }
  }, [user, savedJobIds, isOnline, showOfflineToast]);

  const isJobSaved = useCallback((jobId: string) => {
    return savedJobIds.has(jobId);
  }, [savedJobIds]);

  return {
    savedJobIds,
    isJobSaved,
    toggleSaveJob,
    isLoading,
    savedCount: savedJobIds.size,
  };
};
