import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const SESSION_TOKEN_KEY = 'parium_session_token';
const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

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
 * - Sends heartbeat every 30 min
 * - Listens for session deletion (kicked by another device)
 * - Removes session on logout
 */
export function useSessionManager(
  userId: string | null,
  onKicked: () => void
) {
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const sendHeartbeat = useCallback(async () => {
    const token = sessionTokenRef.current;
    if (!token || !userId) return;

    try {
      const { data: isValid } = await supabase.rpc('heartbeat_session', {
        p_session_token: token,
      });

      if (isValid === false) {
        // Session was removed (kicked by another device)
        console.log('💔 Session invalidated - kicked by another device');
        onKicked();
      }
    } catch (err) {
      console.warn('Heartbeat failed:', err);
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

  // Listen for realtime deletion of our session (kicked)
  useEffect(() => {
    if (!userId) return;

    const token = getOrCreateSessionToken();
    sessionTokenRef.current = token;

    // Register on mount
    registerSession();

    // Start heartbeat
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Listen for our session being deleted (another device kicked us)
    // Also listen for INSERT to detect which new device replaced us
    const channel = supabase
      .channel(`session-watch-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Check if the deleted session is ours
          const deletedToken = (payload.old as any)?.session_token;
          if (deletedToken === sessionTokenRef.current) {
            console.log('🚫 This session was kicked by another device');
            // Store that we were kicked so we can show the toast with device info
            kickedRef.current = true;
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // If we just got kicked, the INSERT tells us which device replaced us
          if (kickedRef.current) {
            kickedRef.current = false;
            const newDevice = (payload.new as any)?.device_label || 'en annan enhet';
            toast({
              title: 'Du har loggats ut',
              description: `En ny session startades på ${newDevice} och denna session avslutades.`,
              variant: 'default',
              duration: 8000,
            });
            onKicked();
          }
        }
      )
      .subscribe();

    // Fallback: if DELETE fires but INSERT never comes (edge case), kick after 3s
    const originalKickedRef = kickedRef;
    const fallbackCheck = setInterval(() => {
      if (originalKickedRef.current) {
        originalKickedRef.current = false;
        toast({
          title: 'Du har loggats ut',
          description: 'Någon loggade in på en annan enhet och din session avslutades.',
          variant: 'default',
          duration: 8000,
        });
        onKicked();
      }
    }, 3000);

    realtimeChannelRef.current = channel;

    return () => {
      clearInterval(fallbackCheck);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [userId, registerSession, sendHeartbeat, onKicked]);

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
