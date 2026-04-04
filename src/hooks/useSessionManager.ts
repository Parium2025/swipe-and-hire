import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_TOKEN_KEY = 'parium_session_token';
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes — well under DB cleanup threshold (20 min)
const VALIDITY_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds — reduced frequency to avoid false kicks on mobile

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
  // Skip session management in Lovable preview or non-production environments
  // to avoid the preview iframe counting as a separate device
  const isPreviewEnv = typeof window !== 'undefined' && (
    window.location.hostname.includes('lovable.app') ||
    window.location.hostname.includes('localhost') ||
    window.self !== window.top // inside an iframe
  );
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const validityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);
  const alreadyKickedRef = useRef(false); // Prevent double-kick
  const lastRegisteredAtRef = useRef<number>(0); // Track when we last registered (ms)
  const consecutiveNetworkFailsRef = useRef(0); // Track network failures to avoid false kicks

  // Ensure auth token is fresh (critical after laptop sleep / app background)
  const ensureFreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        console.warn('⚠️ Auth session unavailable — skipping session management');
        return false;
      }
      // If the token expires within 60s, force a refresh
      const expiresAt = data.session.expires_at ?? 0;
      if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
        console.log('🔄 Token expiring soon — refreshing before session RPC');
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          console.warn('Token refresh failed:', refreshErr.message);
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  // Register session when user logs in (or when returning from background)
  const registerSession = useCallback(async (force = false) => {
    if (!userId || isPreviewEnv) return;
    // Skip if already registered, unless forced (e.g. on mobile foreground)
    if (registeredRef.current && !force) return;

    // Ensure auth token is valid before making RPC call
    const tokenOk = await ensureFreshToken();
    if (!tokenOk) return;

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
      lastRegisteredAtRef.current = Date.now();

      const result = data as Record<string, unknown> | null;
      if (result?.status === 'kicked_oldest') {
        console.log(`📱 Kicked oldest session (${result.kicked_device || 'unknown device'}) to make room for ${result.new_device || 'this device'}`);
      }
    } catch (err) {
      console.warn('Session registration error:', err);
    }
  }, [userId, isPreviewEnv, ensureFreshToken]);

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
        console.log('⚠️ Heartbeat: session expired — attempting re-registration…');

        try {
          const tokenOk = await ensureFreshToken();
          if (!tokenOk) {
            console.log('⏳ Heartbeat: auth token not ready — will retry next cycle');
            return;
          }

          const { data, error } = await supabase.rpc('reregister_session', {
            p_session_token: token,
            p_device_label: getDeviceLabel(),
            p_user_agent: navigator.userAgent.substring(0, 200),
          });

          const result = data as Record<string, unknown> | null;

          if (error) {
            // Auth errors (expired token, not authenticated) → NOT a kick, retry later
            const isAuthError = error.message?.includes('Not authenticated') || error.code === 'PGRST301';
            if (isAuthError) {
              console.log('⏳ Heartbeat: auth error during re-registration — will retry');
              return;
            }
            console.log('🚫 Heartbeat: genuinely kicked — cannot re-register');
            onKicked();
            return;
          }

          if (result?.status === 'rejected') {
            console.log('🚫 Heartbeat: genuinely kicked — cannot re-register');
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

    // Grace period: skip validity check right after registration (mobile wake-up scenario)
    const timeSinceRegistration = Date.now() - lastRegisteredAtRef.current;
    if (timeSinceRegistration < 10_000) return; // 10s grace after register

    try {
      const { data: isValid, error } = await supabase.rpc('is_session_valid', {
        p_session_token: token,
      });

      // Network error — don't kick, just count failures
      if (error) {
        consecutiveNetworkFailsRef.current++;
        console.warn(`Session check network error (${consecutiveNetworkFailsRef.current}x):`, error.message);
        return;
      }

      // Reset network fail counter on success
      consecutiveNetworkFailsRef.current = 0;

      if (isValid === false && !alreadyKickedRef.current) {
        console.log('⚠️ Session missing — attempting re-registration…');

        try {
          const tokenOk = await ensureFreshToken();
          if (!tokenOk) {
            console.log('⏳ Validity: auth token not ready — skipping kick, will retry');
            return;
          }

          const { data, error: reRegError } = await supabase.rpc('reregister_session', {
            p_session_token: token,
            p_device_label: getDeviceLabel(),
            p_user_agent: navigator.userAgent.substring(0, 200),
          });

          const result = data as Record<string, unknown> | null;

          if (reRegError) {
            // Auth errors → NOT a kick, retry later
            const isAuthError = reRegError.message?.includes('Not authenticated') || reRegError.code === 'PGRST301';
            if (isAuthError) {
              console.log('⏳ Validity: auth error during re-registration — will retry');
              return;
            }
            // Other DB errors → also retry, don't kick
            console.warn('Validity: re-registration DB error — will retry:', reRegError.message);
            return;
          }

          if (result?.status === 'rejected') {
            // 2+ other sessions exist → genuinely kicked
            alreadyKickedRef.current = true;
            registeredRef.current = false;
            console.log('🚫 Genuinely kicked — re-registration rejected');
            onKicked();
            return;
          }

          registeredRef.current = true;
          lastRegisteredAtRef.current = Date.now();
          console.log('✅ Session silently re-registered after cron cleanup');
        } catch {
          // Network error during re-registration — do NOT kick, retry next cycle
          console.warn('Re-registration network error — will retry');
        }
      }
    } catch {
      // Network error — skip, try again next interval (mobile may be briefly offline)
      consecutiveNetworkFailsRef.current++;
    }
  }, [userId, onKicked]);

  // Set up session management
  useEffect(() => {
    if (!userId || isPreviewEnv) return;

    const token = getOrCreateSessionToken();
    sessionTokenRef.current = token;

    // Register on mount
    registerSession();

    // Start heartbeat (keeps session alive)
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Start fast validity check (detects kicks within ~30s)
    // Skip the first 10 seconds to allow registration to complete
    const validityStartDelay = setTimeout(() => {
      validityCheckIntervalRef.current = setInterval(checkSessionValidity, VALIDITY_CHECK_INTERVAL_MS);
    }, 10_000);

    // 📱 Mobile background/foreground: re-register immediately when app becomes visible again
    // This prevents false kicks when iOS/Android suspends the app and heartbeats are missed
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 App foregrounded — checking session health');
        consecutiveNetworkFailsRef.current = 0; // Reset fail counter on resume
        // Force re-register to ensure our session is alive after OS suspension
        registerSession(true).then(() => {
          checkSessionValidity();
        });
      }
    };

    // 🌐 Network reconnect: re-register when device comes back online (e.g. subway/tunnel)
    const handleOnline = () => {
      console.log('🌐 Network reconnected — refreshing session');
      consecutiveNetworkFailsRef.current = 0;
      registerSession(true).then(() => {
        checkSessionValidity();
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(validityStartDelay);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
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
