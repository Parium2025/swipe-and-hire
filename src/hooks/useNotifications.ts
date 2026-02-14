import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

const getCached = (userId: string): AppNotification[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { userId: cid, items, ts } = JSON.parse(raw);
    if (cid !== userId || Date.now() - ts > 60 * 60 * 1000) return null;
    return items;
  } catch { return null; }
};

const setCache = (userId: string, items: AppNotification[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, items, ts: Date.now() }));
  } catch {}
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (user) return getCached(user.id) || [];
    return [];
  });
  const [unreadCount, setUnreadCount] = useState(0);

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

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const items = (data || []) as AppNotification[];
      setNotifications(items);
      setUnreadCount(items.filter(n => !n.is_read).length);
      setCache(user.id, items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user]);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
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
          setNotifications(prev => {
            const updated = [newNotif, ...prev];
            setCache(user.id, updated);
            return updated;
          });
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
