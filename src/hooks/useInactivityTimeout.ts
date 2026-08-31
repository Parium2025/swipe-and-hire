import { useEffect, useCallback, useRef } from 'react';
import { updateLastActivity, hasSessionExpiredDueToInactivity, clearActivityTracking } from '@/lib/authStorage';
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
  const logoutPromiseRef = useRef<Promise<boolean> | null>(null);

  const expireSession = useCallback((): Promise<boolean> => {
    if (logoutPromiseRef.current) return logoutPromiseRef.current;

    _inactivityLogoutInProgress = true;
    const logout = (async () => {
      try {
        // Clean up session tracking BEFORE signing out to prevent
        // "logged in on another device" false positives on next login.
        const token = localStorage.getItem('parium_session_token');
        if (token) {
          // After 24h of inactivity the access token is usually expired —
          // without a refresh the RPC runs as anon and is denied.
          const { data } = await supabase.auth.getSession();
          let hasSession = !!data.session;
          const expiresAt = data.session?.expires_at ?? 0;
          if (hasSession && expiresAt - Math.floor(Date.now() / 1000) < 60) {
            const { error: refreshErr } = await supabase.auth.refreshSession();
            hasSession = !refreshErr;
          }
          if (hasSession) {
            await supabase.rpc('remove_session', { p_session_token: token });
          }
        }
      } catch (err) {
        console.warn('Session cleanup on inactivity timeout failed:', err);
      }

      clearSessionToken();

      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          console.warn('Credential logout on inactivity timeout failed:', error.message);
          _inactivityLogoutInProgress = false;
          return false;
        }

        // Keep the expired marker until credential removal has succeeded. A
        // failed logout must remain expired so the next interaction retries
        // instead of silently extending the session.
        clearActivityTracking();
        return true;
      } catch (err) {
        console.warn('Credential logout on inactivity timeout failed:', err);
        _inactivityLogoutInProgress = false;
        return false;
      }
    })();

    logoutPromiseRef.current = logout;
    void logout.finally(() => {
      if (logoutPromiseRef.current === logout) {
        logoutPromiseRef.current = null;
      }
    });
    return logout;
  }, []);

  // Every activity path checks expiry synchronously before it may advance the
  // clock. While an expiry logout is in flight, activity stays inert.
  const handleActivity = useCallback(() => {
    if (!isAuthenticated || _inactivityLogoutInProgress || logoutPromiseRef.current) return;
    if (hasSessionExpiredDueToInactivity()) {
      console.log('⏰ Session expired due to 24h inactivity - logging out');
      void expireSession();
      return;
    }
    updateLastActivity();
  }, [expireSession, isAuthenticated]);

  // Check for expired session on mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkExpiration = () => {
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
        void expireSession();
      }
    };

    // Check on mount
    checkExpiration();

    // Check every 5 minutes
    const interval = setInterval(checkExpiration, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [expireSession, isAuthenticated]);

  // Track activity on user interactions
  useEffect(() => {
    if (!isAuthenticated) return;

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
