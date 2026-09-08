import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TypingUser {
  id: string;
  name: string;
}

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth();
  const userId = user?.id;
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelReadyRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const localTypingRef = useRef({ isTyping: false, name: '' });

  const broadcastTyping = useCallback(async (
    channel: ReturnType<typeof supabase.channel>,
    payload: { user_id: string; is_typing: boolean; name: string },
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
          key: userId,
        },
      },
    });

    channel
      // Broadcast is the primary, immediate typing signal. Presence below is
      // retained as a recovery path after reconnects and across several tabs.
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const remote = payload as {
          user_id?: string;
          is_typing?: boolean;
          name?: string;
        };
        if (!remote.user_id || remote.user_id === userId) return;
        setRemoteTyping(
          { id: remote.user_id, name: remote.name || 'Någon' },
          remote.is_typing === true,
        );
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();

        Object.entries(state).forEach(([remoteUserId, presences]) => {
          if (remoteUserId === userId || !Array.isArray(presences)) return;
          // Samma användare kan vara inloggad på flera enheter/flikar samtidigt.
          // Varje session lägger en egen meta i listan — den första kan vara en
          // passiv session (is_typing=false). Kolla ALLA metas, annars missas
          // skrivandet när en passiv flik råkar ligga först.
          const typingMeta = (presences as { is_typing?: boolean; name?: string }[])
            .find(p => p.is_typing);
          // A stale passive presence must not cancel a newer broadcast. Active
          // presence can restore the indicator; broadcast/timeout clears it.
          if (typingMeta) {
            setRemoteTyping(
              { id: remoteUserId, name: typingMeta.name || 'Någon' },
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
            is_typing: localTyping.isTyping,
            name: localTyping.name,
          });
          // Typing can begin during a cold connection. Re-send the current
          // state as soon as the channel is ready so the first keystrokes count.
          if (localTyping.isTyping) {
            await broadcastTyping(channel, {
              user_id: userId,
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
      remoteTypingTimeoutsRef.current.forEach(clearTimeout);
      remoteTypingTimeoutsRef.current.clear();
      setTypingUsers([]);
      channelReadyRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [broadcastTyping, conversationId, setRemoteTyping, userId]);

  // Start typing indicator
  const startTyping = useCallback(async (userName: string) => {
    localTypingRef.current = { isTyping: true, name: userName };
    if (!channelRef.current || !userId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send immediately to the other open chat, with presence as reconnect fallback.
    const channel = channelRef.current;
    const tasks: Promise<unknown>[] = [
      broadcastTyping(channel, {
        user_id: userId,
        is_typing: true,
        name: userName,
      }),
    ];
    if (channelReadyRef.current) {
      tasks.push(channel.track({ is_typing: true, name: userName }));
    }
    await Promise.allSettled(tasks);

    // Auto-stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      localTypingRef.current = { isTyping: false, name: userName };
      if (channelRef.current) {
        const channel = channelRef.current;
        const tasks: Promise<unknown>[] = [
          broadcastTyping(channel, {
            user_id: userId,
            is_typing: false,
            name: userName,
          }),
        ];
        if (channelReadyRef.current) {
          tasks.push(channel.track({ is_typing: false, name: userName }));
        }
        await Promise.allSettled(tasks);
      }
    }, 3000);
  }, [broadcastTyping, userId]);

  // Stop typing indicator
  const stopTyping = useCallback(async (userName: string) => {
    localTypingRef.current = { isTyping: false, name: userName };
    if (!channelRef.current || !userId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const channel = channelRef.current;
    const tasks: Promise<unknown>[] = [
      broadcastTyping(channel, {
        user_id: userId,
        is_typing: false,
        name: userName,
      }),
    ];
    if (channelReadyRef.current) {
      tasks.push(channel.track({ is_typing: false, name: userName }));
    }
    await Promise.allSettled(tasks);
  }, [broadcastTyping, userId]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
