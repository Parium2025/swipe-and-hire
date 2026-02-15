import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const SESSION_TOKEN_KEY = 'parium_session_token';
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
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
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);
  const kickedRef = useRef(false);

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
        // Session row is gone — could be:
        // 1. Kicked by another device (handled by Realtime DELETE listener)
        // 2. Expired while offline (cron cleaned it up)
        // → Try to silently re-register before assuming kicked
        console.log('⚠️ Session expired — attempting silent re-registration…');
        registeredRef.current = false;

        try {
          const { data, error } = await supabase.rpc('register_session', {
            p_session_token: token,
            p_device_label: getDeviceLabel(),
            p_ip_address: null,
            p_user_agent: navigator.userAgent.substring(0, 200),
          });

          if (error) {
            console.warn('Re-registration failed — kicking user:', error.message);
            onKicked();
            return;
          }

          registeredRef.current = true;
          const result = data as Record<string, unknown> | null;

          if (result?.status === 'kicked_oldest') {
            console.log(`📱 Re-registered and kicked oldest session (${result.kicked_device || 'unknown'})`);
          } else {
            console.log('✅ Session silently re-registered after offline period');
          }
        } catch (reRegErr) {
          console.warn('Re-registration error — kicking user:', reRegErr);
          onKicked();
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
  const checkSessionValidity = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token || !userId || !registeredRef.current) return;

    try {
      const { data: isValid } = await supabase.rpc('is_session_valid', {
        p_session_token: token,
      });

      if (isValid === false) {
        console.log('🚫 Session no longer valid — kicked by another device');
        toast({
          title: 'Du har loggats ut',
          description: 'En ny session startades på en annan enhet och denna session avslutades.',
          variant: 'default',
          duration: 8000,
        });
        onKicked();
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
