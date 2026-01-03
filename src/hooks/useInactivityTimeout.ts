import { useEffect, useCallback } from 'react';
import { updateLastActivity, hasSessionExpiredDueToInactivity, clearActivityTracking } from '@/lib/authStorage';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that tracks user activity and handles 24-hour inactivity timeout
 * Should be used in the root component (App.tsx or AuthProvider)
 */
export const useInactivityTimeout = (isAuthenticated: boolean) => {
  // Update activity on user interactions
  const handleActivity = useCallback(() => {
    if (isAuthenticated) {
      updateLastActivity();
    }
  }, [isAuthenticated]);

  // Check for expired session on mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkExpiration = async () => {
      if (hasSessionExpiredDueToInactivity()) {
        console.log('⏰ Session expired due to 24h inactivity - logging out');
        clearActivityTracking();
        await supabase.auth.signOut();
      }
    };

    // Check on mount
    checkExpiration();

    // Check every 5 minutes
    const interval = setInterval(checkExpiration, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Track activity on user interactions
  useEffect(() => {
    if (!isAuthenticated) return;

    // Update activity immediately when hook mounts (user is active)
    updateLastActivity();

    // Events to track
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    
    // Throttle activity updates to avoid excessive writes
    let lastUpdate = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) { // Update at most once per minute
        lastUpdate = now;
        handleActivity();
      }
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true });
    });

    // Also track page visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledHandler);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, handleActivity]);
};
