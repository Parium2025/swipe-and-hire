import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TypingUser {
  id: string;
  name: string;
}

interface TypingPayload {
  user_id: string;
  session_id: string;
  sequence: number;
  is_typing: boolean;
  name: string;
}

const TYPING_IDLE_MS = 3000;
const TYPING_HEARTBEAT_MS = 1500;

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth();
  const userId = user?.id;
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelReadyRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteTypingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const localTypingRef = useRef({ isTyping: false, name: '' });
  const localSequenceRef = useRef(0);
  const remoteSequenceRef = useRef(new Map<string, number>());
  const sessionIdRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );

  const broadcastTyping = useCallback(async (
    channel: ReturnType<typeof supabase.channel>,
    payload: TypingPayload,
  ) => {
    // Mobile Safari can fire the first input events while the websocket is
    // still connecting. Use the socket only when it is confirmed ready and
    // otherwise send through Realtime's explicit HTTP transport. This avoids
    // the deprecated implicit fallback which could silently lose the signal.
    if (!channelReadyRef.current) {
      await channel.httpSend('typing', payload, { timeout: 2500 });
      return;
    }

    const result = await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload,
    });

    if (result !== 'ok') {
      await channel.httpSend('typing', payload, { timeout: 2500 });
    }
  }, []);

  const sendTypingState = useCallback((isTyping: boolean, name: string) => {
    const channel = channelRef.current;
    if (!channel || !userId) return;

    const payload: TypingPayload = {
      user_id: userId,
      session_id: sessionIdRef.current,
      sequence: ++localSequenceRef.current,
      is_typing: isTyping,
      name,
    };

    // Never await network delivery from the input handler. On a cold mobile
    // connection several awaited keystrokes could finish out of order and let
    // an old stop signal hide a newer active typing state.
    void broadcastTyping(channel, payload).catch(() => undefined);
    if (channelReadyRef.current) {
      void channel.track(payload).catch(() => undefined);
    }
  }, [broadcastTyping, userId]);

  const setRemoteTyping = useCallback((remoteUser: TypingUser, isTyping: boolean) => {
    const existingTimeout = remoteTypingTimeoutsRef.current.get(remoteUser.id);
    if (existingTimeout) clearTimeout(existingTimeout);
    remoteTypingTimeoutsRef.current.delete(remoteUser.id);

    setTypingUsers(current => {
      const withoutUser = current.filter(item => item.id !== remoteUser.id);
      return isTyping ? [...withoutUser, remoteUser] : withoutUser;
    });

    if (isTyping) {
      const timeout = setTimeout(() => {
        setTypingUsers(current => current.filter(item => item.id !== remoteUser.id));
        remoteTypingTimeoutsRef.current.delete(remoteUser.id);
      }, 4000);
      remoteTypingTimeoutsRef.current.set(remoteUser.id, timeout);
    }
  }, []);

  // Set up presence channel for typing indicators
  useEffect(() => {
    if (!conversationId || !userId) return;

    // Presence requires the shared conversation topic across different clients.
    const channel = supabase.channel(`typing-${conversationId}`, {
      config: {
        broadcast: {
          ack: true,
        },
        presence: {
          // One user can have several devices/tabs. A session-specific key
          // keeps a passive device from overwriting the actively typing one.
          key: `${userId}:${sessionIdRef.current}`,
        },
      },
    });

    channel
      // Broadcast is the primary, immediate typing signal. Presence below is
      // retained as a recovery path after reconnects and across several tabs.
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const remote = payload as {
          user_id?: string;
          session_id?: string;
          sequence?: number;
          is_typing?: boolean;
          name?: string;
        };
        if (!remote.user_id || remote.session_id === sessionIdRef.current) return;
        // Older published clients do not include session_id. Continue to
        // understand those events while new clients remain device-specific.
        const remoteId = remote.session_id || remote.user_id;
        if (typeof remote.sequence === 'number') {
          const lastSequence = remoteSequenceRef.current.get(remoteId) ?? -1;
          if (remote.sequence <= lastSequence) return;
          remoteSequenceRef.current.set(remoteId, remote.sequence);
        }
        setRemoteTyping(
          { id: remoteId, name: remote.name || 'Någon' },
          remote.is_typing === true,
        );
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();

        Object.entries(state).forEach(([presenceKey, presences]) => {
          if (!Array.isArray(presences)) return;
          // Samma användare kan vara inloggad på flera enheter/flikar samtidigt.
          // Varje session lägger en egen meta i listan — den första kan vara en
          // passiv session (is_typing=false). Kolla ALLA metas, annars missas
          // skrivandet när en passiv flik råkar ligga först.
          const typingMeta = (presences as { user_id?: string; session_id?: string; is_typing?: boolean; name?: string }[])
            .find(p => p.is_typing);
          // A stale passive presence must not cancel a newer broadcast. Active
          // presence can restore the indicator; broadcast/timeout clears it.
          if (typingMeta) {
            const remoteId = typingMeta.session_id || presenceKey;
            if (remoteId === sessionIdRef.current) return;
            setRemoteTyping(
              { id: remoteId, name: typingMeta.name || 'Någon' },
              true,
            );
          }
        });
      })
      .subscribe(async (status) => {
        channelReadyRef.current = status === 'SUBSCRIBED';
        if (status === 'SUBSCRIBED') {
          const localTyping = localTypingRef.current;
          await channel.track({
            user_id: userId,
            session_id: sessionIdRef.current,
            sequence: localSequenceRef.current,
            is_typing: localTyping.isTyping,
            name: localTyping.name,
          });
          // Typing can begin during a cold connection. Re-send the current
          // state as soon as the channel is ready so the first keystrokes count.
          if (localTyping.isTyping) {
            await broadcastTyping(channel, {
              user_id: userId,
              session_id: sessionIdRef.current,
              sequence: ++localSequenceRef.current,
              is_typing: true,
              name: localTyping.name,
            });
          }
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      remoteTypingTimeoutsRef.current.forEach(clearTimeout);
      remoteTypingTimeoutsRef.current.clear();
      remoteSequenceRef.current.clear();
      setTypingUsers([]);
      channelReadyRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [broadcastTyping, conversationId, setRemoteTyping, userId]);

  // Start typing indicator
  const startTyping = useCallback((userName: string) => {
    const wasTyping = localTypingRef.current.isTyping;
    localTypingRef.current = { isTyping: true, name: userName };

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send immediately on the first keystroke. A heartbeat then repairs any
    // signal lost while Safari wakes its socket or changes network transport.
    if (!wasTyping) {
      sendTypingState(true, userName);
    }
    if (!heartbeatRef.current) {
      heartbeatRef.current = setInterval(() => {
        const localTyping = localTypingRef.current;
        if (localTyping.isTyping) {
          sendTypingState(true, localTyping.name);
        }
      }, TYPING_HEARTBEAT_MS);
    }

    typingTimeoutRef.current = setTimeout(() => {
      localTypingRef.current = { isTyping: false, name: userName };
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      sendTypingState(false, userName);
    }, TYPING_IDLE_MS);
  }, [sendTypingState]);

  // Stop typing indicator
  const stopTyping = useCallback((userName: string) => {
    localTypingRef.current = { isTyping: false, name: userName };
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    sendTypingState(false, userName);
  }, [sendTypingState]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
