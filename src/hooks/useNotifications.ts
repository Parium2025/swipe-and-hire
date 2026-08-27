import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannel } from '@/lib/realtimeChannel';
import { useAuth } from '@/hooks/useAuth';
import { safeReadArrayCache } from '@/lib/safeStorage';
import { toastArchive, setToastArchiveUser } from '@/lib/toastArchive';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

const CACHE_KEY = 'parium_notifications_cache';

// Chattmeddelanden räknas redan i sidomenyns chattbadge — de ska aldrig
// dyka upp i klockan/notiscentret.
const HIDDEN_TYPES = new Set(['message', 'new_message', 'chat_message']);
const isHiddenType = (type: string) => HIDDEN_TYPES.has(type);


const getCached = (userId: string): AppNotification[] | null => {
  return safeReadArrayCache<AppNotification>(CACHE_KEY, 'items', (env) => {
    return env.userId === userId && typeof env.ts === 'number' && Date.now() - env.ts < 60 * 60 * 1000;
  });
};

const setCache = (userId: string, items: AppNotification[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, items, ts: Date.now() }));
  } catch {}
};

export function useNotifications() {
  const { user } = useAuth();
  // Kontospecifikt lokalt notisarkiv — två flikar med olika konton på samma
  // enhet får aldrig dela lokala toaster.
  if (typeof window !== 'undefined') setToastArchiveUser(user?.id ?? null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (user) return getCached(user.id) || [];
    return [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    if (!user) return 0;
    return (getCached(user.id) || []).filter(n => !n.is_read).length;
  });

  // Hydrate from cache on user change
  useEffect(() => {
    if (user) {
      const cached = getCached(user.id);
      if (cached) {
        setNotifications(cached);
        setUnreadCount(cached.filter(n => !n.is_read).length);
      }
    }
  }, [user]);

  // Typer där användaren själv stängt av in-app-notiser. Raden finns kvar i
  // databasen (push/mejl styrs separat), men klockan ska hållas tyst.
  const mutedTypesRef = useRef<Set<string>>(new Set());
  const broadcastRef = useRef<RealtimeChannel | null>(null);

  const loadMutedTypes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notification_preferences')
      .select('notification_type, in_app_enabled')
      .eq('user_id', user.id);
    mutedTypesRef.current = new Set(
      (data ?? []).filter((p) => p.in_app_enabled === false).map((p) => p.notification_type)
    );
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      await loadMutedTypes();
      const excluded = Array.from(
        new Set([...mutedTypesRef.current, ...HIDDEN_TYPES])
      );
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id);
      if (excluded.length) query = query.not('type', 'in', `(${excluded.join(',')})`);

      const [{ data, error }, countRes] = await Promise.all([
        query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE),
        (() => {
          let c = supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
          if (excluded.length) c = c.not('type', 'in', `(${excluded.join(',')})`);
          return c;
        })(),
      ]);

      if (error) throw error;
      const items = (data || []) as AppNotification[];
      setNotifications(items);
      // Räknaren kommer från servern — den får aldrig begränsas av hur många
      // sidor som råkar vara laddade i klockan.
      setUnreadCount(countRes.count ?? items.filter(n => !n.is_read).length);
      setHasMore(items.length === PAGE_SIZE);
      setCache(user.id, items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user, loadMutedTypes]);

  // Oändlig scroll: hämta nästa sida med keyset-paginering (created_at + id),
  // vilket håller sig snabbt även vid tiotusentals notiser.
  const loadMore = useCallback(async () => {
    if (!user || loadingMoreRef.current) return;
    const last = notificationsRef.current[notificationsRef.current.length - 1];
    if (!last) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const excluded = Array.from(new Set([...mutedTypesRef.current, ...HIDDEN_TYPES]));
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`);
      if (excluded.length) query = query.not('type', 'in', `(${excluded.join(',')})`);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const page = (data || []) as AppNotification[];
      setNotifications(prev => {
        const seen = new Set(prev.map(n => n.id));
        const merged = [...prev, ...page.filter(n => !seen.has(n.id))];
        setCache(user.id, merged.slice(0, PAGE_SIZE));
        return merged;
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [user]);



  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refetch when the local toast archive syncs a new item to the account
  useEffect(() => {
    const handler = () => fetchNotifications();
    window.addEventListener('parium:notifications-refresh', handler);
    return () => window.removeEventListener('parium:notifications-refresh', handler);
  }, [fetchNotifications]);

  // Refetch when user returns to tab (after reading article, etc.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = createRealtimeChannel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          if (mutedTypesRef.current.has(newNotif.type) || isHiddenType(newNotif.type)) return;
          setNotifications(prev => {
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            const updated = [newNotif, ...prev];
            setCache(user.id, updated);
            return updated;
          });
          setUnreadCount(prev => prev + 1);
        }

      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotif = payload.new as AppNotification;
          setNotifications(prev => {
            const updated = prev.map(n => (n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n));
            setCache(user.id, updated);
            setUnreadCount(updated.filter(n => !n.is_read).length);
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const removed = payload.old as Partial<AppNotification>;
          if (!removed?.id) return;
          setNotifications(prev => {
            if (!prev.some(n => n.id === removed.id)) return prev;
            const updated = prev.filter(n => n.id !== removed.id);
            setCache(user.id, updated);
            setUnreadCount(updated.filter(n => !n.is_read).length);
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_preferences',
          filter: `user_id=eq.${user.id}`,
        },
        () => { void fetchNotifications(); }
      )
      // Lokala toast-notiser lever i localStorage per enhet – synka rensning
      // och "markera alla lästa" mellan användarens enheter via broadcast.
      .on('broadcast', { event: 'local_clear' }, () => { toastArchive.clear(); })
      .on('broadcast', { event: 'local_read_all' }, () => { toastArchive.markAllAsRead(); })
      .subscribe();

    broadcastRef.current = channel;
    return () => { broadcastRef.current = null; supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);


  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    // Optimistic
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      setCache(user.id, updated);
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    // Optimistic
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, is_read: true }));
      setCache(user.id, updated);
      return updated;
    });
    setUnreadCount(0);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    void broadcastRef.current?.send({ type: 'broadcast', event: 'local_read_all', payload: {} });
  }, [user]);

  const clearAll = useCallback(async () => {
    if (!user) return;

    setNotifications([]);
    setUnreadCount(0);
    setCache(user.id, []);

    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    void broadcastRef.current?.send({ type: 'broadcast', event: 'local_clear', payload: {} });
  }, [user]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    refetch: fetchNotifications,
  };
}
