import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Minimum interval between activity updates (5 minutes)
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function useActivityTracker() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!user?.id) return;

    const updateActivity = async () => {
      const now = Date.now();
      
      // Only update if enough time has passed
      if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) {
        return;
      }

      lastUpdateRef.current = now;

      try {
        await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Failed to update activity:', error);
      }
    };

    // Update on mount
    updateActivity();

    // Update on visibility change (user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };

    // Update on user interaction
    const handleActivity = () => {
      updateActivity();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleActivity);
    
    // Periodic update while active
    const interval = setInterval(updateActivity, UPDATE_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleActivity);
      clearInterval(interval);
    };
  }, [user?.id]);
}
