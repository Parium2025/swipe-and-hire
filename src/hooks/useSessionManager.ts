import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_TOKEN_KEY = 'parium_session_token';
const SESSION_TOKEN_COOKIE = 'parium_device_token';
const HEARTBEAT_INTERVAL_MS = 90 * 1000; // 90s — well under DB cleanup threshold (5 min)
const VALIDITY_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds — reduced frequency to avoid false kicks on mobile

/**
 * Generate a unique session token per browser (persisted in localStorage).
 * Same browser = same token across tabs (so multiple tabs count as ONE session).
 */
const SESSION_TOKEN_LOCK = 'parium-session-token-lock';
const SESSION_TOKEN_MUTEX_KEY = 'parium_session_token_mutex';

const readSharedDomainToken = (): string | null => {
  try {
    const prefix = `${SESSION_TOKEN_COOKIE}=`;
    const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
  } catch {
    return null;
  }
};

const writeSharedDomainToken = (token: string): void => {
  try {
    const hostname = window.location.hostname.toLowerCase();
    const domain = hostname === 'parium.se' || hostname.endsWith('.parium.se')
      ? '; Domain=.parium.se'
      : '';
    document.cookie = `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure${domain}`;
  } catch {
    // localStorage remains the fallback outside the production domains.
  }
};

const readOrCreateStoredToken = (): string => {
  // Root and www are separate localStorage origins. The first-party cookie is
  // shared across .parium.se so the same browser cannot count twice merely by
  // moving between parium.se and www.parium.se.
  const shared = readSharedDomainToken();
  if (shared) {
    localStorage.setItem(SESSION_TOKEN_KEY, shared);
    return shared;
  }

  const existing = localStorage.getItem(SESSION_TOKEN_KEY);
  if (existing) {
    writeSharedDomainToken(existing);
    return existing;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_TOKEN_KEY, created);
  const stored = localStorage.getItem(SESSION_TOKEN_KEY) ?? created;
  writeSharedDomainToken(stored);
  return stored;
};

/**
 * Get one stable token per browser profile, including when several new tabs
 * open simultaneously. A plain get/set has a race where two empty tabs can
 * each return a different UUID and therefore look like two devices.
 */
async function getOrCreateSessionToken(): Promise<string> {
  try {
    const lockManager = navigator.locks;
    if (lockManager) {
      return await lockManager.request(SESSION_TOKEN_LOCK, { mode: 'exclusive' }, () =>
        readOrCreateStoredToken()
      );
    }

    // Cross-tab fallback for browsers without Web Locks.
    const owner = crypto.randomUUID();
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const now = Date.now();
      const raw = localStorage.getItem(SESSION_TOKEN_MUTEX_KEY);
      const [currentOwner, expiresRaw] = raw?.split(':') ?? [];
      const expiresAt = Number(expiresRaw ?? 0);

      if (!currentOwner || !Number.isFinite(expiresAt) || expiresAt <= now) {
        localStorage.setItem(SESSION_TOKEN_MUTEX_KEY, `${owner}:${now + 1_000}`);
        if (localStorage.getItem(SESSION_TOKEN_MUTEX_KEY)?.startsWith(`${owner}:`)) {
          try {
            return readOrCreateStoredToken();
          } finally {
            if (localStorage.getItem(SESSION_TOKEN_MUTEX_KEY)?.startsWith(`${owner}:`)) {
              localStorage.removeItem(SESSION_TOKEN_MUTEX_KEY);
            }
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
    }

    return readOrCreateStoredToken();
  } catch {
    // Private browsing fallback: stable for this tab's lifetime.
    try {
      const existing = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (existing) return existing;
      const created = crypto.randomUUID();
      sessionStorage.setItem(SESSION_TOKEN_KEY, created);
      return created;
    } catch {
      return crypto.randomUUID();
    }
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
  const registrationPromiseRef = useRef<Promise<void> | null>(null);

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

    // Visibility/online/auth events may fire together. One registration at a
    // time avoids duplicate RPCs and makes tab startup deterministic.
    if (registrationPromiseRef.current) {
      await registrationPromiseRef.current;
      return;
    }

    const registration = (async () => {

      // Ensure auth token is valid before making RPC call
      const tokenOk = await ensureFreshToken();
      if (!tokenOk) return;

      const token = await getOrCreateSessionToken();
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
    })();

    registrationPromiseRef.current = registration;
    try {
      await registration;
    } finally {
      if (registrationPromiseRef.current === registration) {
        registrationPromiseRef.current = null;
      }
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
  }, [userId, onKicked, ensureFreshToken]);

  // Remove session on logout
  const removeSession = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token) return;

    try {
      // The RPC requires an authenticated JWT. If the token is missing or
      // expired the request runs as anon and fails with "permission denied".
      const tokenOk = await ensureFreshToken();
      if (tokenOk) {
        await supabase.rpc('remove_session', { p_session_token: token });
      }
    } catch (err) {
      console.warn('Session removal failed:', err);
    }

    registeredRef.current = false;
    sessionTokenRef.current = null;
  }, [ensureFreshToken]);

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
  }, [userId, onKicked, ensureFreshToken]);

  // Set up session management
  useEffect(() => {
    if (!userId || isPreviewEnv) return;

    // Register on mount
    void registerSession();

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
 * Preserve the browser's session token across logouts/reloads by default.
 *
 * Why: this token identifies the physical browser/device for the concurrent
 * session limiter. Rotating it on local logout/recovery makes the SAME device
 * look like a brand-new device, which can create duplicate rows in
 * `user_sessions` and falsely trigger the "another device" kick flow.
 *
 * Kept as a compatibility API because several auth flows still call it.
 * Pass `true` only if we ever need a hard reset of the browser identity.
 */
export function clearSessionToken(force = false): void {
  if (!force) return;
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}
