import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_TOKEN_KEY = 'parium_session_token';
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — must be well under DB cleanup threshold (20 min)
const VALIDITY_CHECK_INTERVAL_MS = 15 * 1000; // 15 seconds — fast kick detection

/**
 * Generate a unique session token per browser (persisted in localStorage).
 * Same browser = same token across tabs (so multiple tabs count as ONE session).
 */
function getOrCreateSessionToken(): string {
  try {
    let token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
  } catch {
    // Fallback for private browsing
    return crypto.randomUUID();
  }
}

/**
 * Detect detailed device label from user agent.
 * Returns a human-readable label like "iPhone · Safari", "Android · Chrome", "Windows · Chrome", etc.
 */
function getDeviceLabel(): string {
  const ua = navigator.userAgent;

  // Detect OS/device
  let device = 'Okänd enhet';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    device = 'iPad';
  } else if (/iPhone/i.test(ua)) {
    device = 'iPhone';
  } else if (/Android/i.test(ua) && /Mobile/i.test(ua)) {
    device = 'Android';
  } else if (/Android/i.test(ua)) {
    device = 'Android-surfplatta';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    device = 'Mac';
  } else if (/Windows/i.test(ua)) {
    device = 'Windows';
  } else if (/Linux/i.test(ua)) {
    device = 'Linux';
  } else if (/CrOS/i.test(ua)) {
    device = 'Chromebook';
  }

  // Detect browser
  let browser = '';
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox';
  }

  return browser ? `${device} · ${browser}` : device;
}

/**
 * Hook that manages max 2 concurrent sessions per user.
 * - Registers session on login
 * - Sends heartbeat every 10 min
 * - Listens for session deletion (kicked by another device)
 * - Removes session on logout
 */
export function useSessionManager(
  userId: string | null,
  onKicked: () => void
) {
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const validityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);
  const alreadyKickedRef = useRef(false); // Prevent double-kick

  // Register session when user logs in
  const registerSession = useCallback(async () => {
    if (!userId || registeredRef.current) return;

    const token = getOrCreateSessionToken();
    sessionTokenRef.current = token;

    try {
      const { data, error } = await supabase.rpc('register_session', {
        p_session_token: token,
        p_device_label: getDeviceLabel(),
        p_ip_address: null,
        p_user_agent: navigator.userAgent.substring(0, 200),
      });

      if (error) {
        console.warn('Session registration failed:', error.message);
        return;
      }

      registeredRef.current = true;

      const result = data as Record<string, unknown> | null;
      if (result?.status === 'kicked_oldest') {
        console.log(`📱 Kicked oldest session (${result.kicked_device || 'unknown device'}) to make room for ${result.new_device || 'this device'}`);
      }
    } catch (err) {
      console.warn('Session registration error:', err);
    }
  }, [userId]);

  // Heartbeat to keep session alive
  // If heartbeat returns false (session expired after offline), try to re-register.
  // Only kick if re-registration reveals we're over the session limit AND got replaced.
  const sendHeartbeat = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token || !userId) return;

    try {
      const { data: isValid } = await supabase.rpc('heartbeat_session', {
        p_session_token: token,
      });

      if (isValid === false) {
        // Session row gone — check if genuinely kicked or cron cleanup
        console.log('⚠️ Heartbeat: session expired — checking active sessions…');

        try {
          const { data: activeSessions } = await supabase.rpc('get_active_sessions');
          const otherSessions = ((activeSessions as any[]) || []).filter(
            (s) => s.session_token !== token
          );

          if (otherSessions.length >= 2) {
            // Genuinely kicked
            console.log('🚫 Heartbeat: genuinely kicked — 2 other sessions active');
            onKicked();
            return;
          }

          // Safe to re-register
          console.log(`✅ Heartbeat: ${otherSessions.length} other session(s) — re-registering`);
          registeredRef.current = false;

          const { error } = await supabase.rpc('register_session', {
            p_session_token: token,
            p_device_label: getDeviceLabel(),
            p_ip_address: null,
            p_user_agent: navigator.userAgent.substring(0, 200),
          });

          if (error) {
            console.warn('Heartbeat re-registration failed — kicking:', error.message);
            onKicked();
            return;
          }

          registeredRef.current = true;
          console.log('✅ Heartbeat: session re-registered after cron cleanup');
        } catch (reRegErr) {
          console.warn('Heartbeat re-registration error:', reRegErr);
        }
      }
    } catch (err) {
      // Network error (still offline) — do nothing, try again next interval
      console.warn('Heartbeat failed (likely offline):', err);
    }
  }, [userId, onKicked]);

  // Remove session on logout
  const removeSession = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token) return;

    try {
      await supabase.rpc('remove_session', { p_session_token: token });
    } catch (err) {
      console.warn('Session removal failed:', err);
    }

    registeredRef.current = false;
    sessionTokenRef.current = null;
  }, []);

  // Fast validity check — polls every 15s to detect if our session was kicked
  // If session is gone, try to re-register first (it may have been cleaned by cron).
  // Only kick if re-registration shows we replaced someone (meaning 2 others exist).
  const checkSessionValidity = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token || !userId || !registeredRef.current || alreadyKickedRef.current) return;

    try {
      const { data: isValid } = await supabase.rpc('is_session_valid', {
        p_session_token: token,
      });

      if (isValid === false && !alreadyKickedRef.current) {
        // Session row is gone — check if we were genuinely kicked (2 other sessions exist)
        // or if it was just cron cleanup (< 2 sessions exist).
        console.log('⚠️ Session missing — checking if kicked or cron cleanup…');

        try {
          const { data: activeSessions } = await supabase.rpc('get_active_sessions');
          const otherSessions = ((activeSessions as any[]) || []).filter(
            (s) => s.session_token !== token
          );

          if (otherSessions.length >= 2) {
            // 2 other sessions exist → we were genuinely kicked by a new device
            alreadyKickedRef.current = true;
            registeredRef.current = false;
            console.log('🚫 Genuinely kicked — 2 other sessions active');
            onKicked();
            return;
          }

          // < 2 other sessions → cron cleanup, safe to re-register
          console.log(`✅ Only ${otherSessions.length} other session(s) — re-registering (cron cleanup)`);
          registeredRef.current = false;

          const { data, error } = await supabase.rpc('register_session', {
            p_session_token: token,
            p_device_label: getDeviceLabel(),
            p_ip_address: null,
            p_user_agent: navigator.userAgent.substring(0, 200),
          });

          if (error) {
            alreadyKickedRef.current = true;
            console.log('🚫 Re-registration failed — kicking user');
            onKicked();
            return;
          }

          registeredRef.current = true;
          console.log('✅ Session silently re-registered after cron cleanup');
        } catch {
          // Network error — don't kick, try again next cycle
          console.warn('Re-registration network error — will retry');
        }
      }
    } catch {
      // Network error — skip, try again next interval
    }
  }, [userId, onKicked]);

  // Set up session management
  useEffect(() => {
    if (!userId) return;

    const token = getOrCreateSessionToken();
    sessionTokenRef.current = token;

    // Register on mount
    registerSession();

    // Start heartbeat (keeps session alive)
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Start fast validity check (detects kicks within ~15s)
    // Skip the first 5 seconds to allow registration to complete
    const validityStartDelay = setTimeout(() => {
      validityCheckIntervalRef.current = setInterval(checkSessionValidity, VALIDITY_CHECK_INTERVAL_MS);
    }, 5000);

    return () => {
      clearTimeout(validityStartDelay);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (validityCheckIntervalRef.current) {
        clearInterval(validityCheckIntervalRef.current);
        validityCheckIntervalRef.current = null;
      }
    };
  }, [userId, registerSession, sendHeartbeat, checkSessionValidity]);

  return { removeSession };
}

/**
 * Clear the session token from storage (call on full logout cleanup)
 */
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}
