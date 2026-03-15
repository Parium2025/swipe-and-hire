import { useEffect, useCallback } from 'react';
import { updateLastActivity, hasSessionExpiredDueToInactivity, clearActivityTracking, refreshSessionSentinel } from '@/lib/authStorage';
import { supabase } from '@/integrations/supabase/client';
import { clearSessionToken } from '@/hooks/useSessionManager';

/**
 * Module-level flag so onAuthStateChange in useAuth can distinguish
 * an inactivity-timeout logout from a cross-tab logout.
 */
let _inactivityLogoutInProgress = false;
export const isInactivityLogout = () => _inactivityLogoutInProgress;
export const clearInactivityLogoutFlag = () => { _inactivityLogoutInProgress = false; };

/**
 * Hook that tracks user activity and handles 24-hour inactivity timeout
 * Also refreshes the session sentinel so the tab is recognized as alive
 */
export const useInactivityTimeout = (isAuthenticated: boolean) => {
  // Update activity on user interactions
  const handleActivity = useCallback(() => {
    if (isAuthenticated) {
      updateLastActivity();
      refreshSessionSentinel();
    }
  }, [isAuthenticated]);

  // Check for expired session on mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkExpiration = async () => {
      // Log current activity status for debugging
      const localActivity = localStorage.getItem('parium-last-activity');
      const sessionActivity = sessionStorage.getItem('parium-last-activity');
      const lastActivityStr = localActivity || sessionActivity;
      
      if (lastActivityStr) {
        const lastActivityTime = parseInt(lastActivityStr, 10);
        const now = Date.now();
        const hoursSinceActivity = (now - lastActivityTime) / (1000 * 60 * 60);
        console.log(`📊 Activity check: Last activity ${hoursSinceActivity.toFixed(2)} hours ago`);
      }
      
      if (hasSessionExpiredDueToInactivity()) {
        console.log('⏰ Session expired due to 24h inactivity - logging out');
        clearActivityTracking();
        
        // Clean up session tracking BEFORE signing out to prevent
        // "logged in on another device" false positives on next login
        try {
          const token = localStorage.getItem('parium_session_token');
          if (token) {
            await supabase.rpc('remove_session', { p_session_token: token });
          }
        } catch (err) {
          console.warn('Session cleanup on inactivity timeout failed:', err);
        }
        clearSessionToken();
        
        await supabase.auth.signOut({ scope: 'local' });
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
