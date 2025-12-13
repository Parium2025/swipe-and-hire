import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useSavedJobs = () => {
  const { user } = useAuth();
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch saved job IDs on mount
  useEffect(() => {
    if (!user) {
      setSavedJobIds(new Set());
      setIsLoading(false);
      return;
    }

    const fetchSavedJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('saved_jobs')
          .select('job_id')
          .eq('user_id', user.id);

        if (error) throw error;

        setSavedJobIds(new Set(data?.map(item => item.job_id) || []));
      } catch (err) {
        console.error('Error fetching saved jobs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedJobs();
  }, [user]);

  const toggleSaveJob = useCallback(async (jobId: string) => {
    if (!user) {
      toast.error('Du måste vara inloggad för att spara jobb');
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
        return next;
      });
      console.error('Error toggling saved job:', err);
      toast.error('Kunde inte spara jobbet');
    }
  }, [user, savedJobIds]);

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
