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

// Hur många notiser som hämtas per sida. Fler laddas automatiskt när
// användaren scrollar ner i klockan.
const PAGE_SIZE = 200;

// Chattmeddelanden hör hemma i Chattar-badgen och chattlistan. Att även lägga
// varje meddelande i klockan skapar dubbla, röriga indikatorer.
const HIDDEN_TYPES = new Set(['message', 'new_message', 'chat_message']);
const isHiddenType = (type: string) => HIDDEN_TYPES.has(type);


const getCached = (userId: string): AppNotification[] | null => {
  const cached = safeReadArrayCache<AppNotification>(CACHE_KEY, 'items', (env) => {
    return env.userId === userId && typeof env.ts === 'number' && Date.now() - env.ts < 60 * 60 * 1000;
  });
  return cached?.filter((notification) => !isHiddenType(notification.type)) ?? null;
};

/**
 * Klockan ska vara på plats direkt vid uppstart — inte några sekunder efter.
 * Auth tar en stund att lösa ut, och tidigare låg cacheläsningen bakom `user`,
 * så badgen var tom tills sessionen var klar. Cachen rensas vid utloggning
 * (se useEagerRatingsPreload), så den tillhör alltid det konto som är på väg in.
 * Skulle auth ändå lösa ut ett annat konto nollställs den direkt i effekten nedan.
 */
const getCachedBeforeAuth = (): AppNotification[] | null => {
  const cached = safeReadArrayCache<AppNotification>(CACHE_KEY, 'items', (env) => {
    return typeof env.ts === 'number' && Date.now() - env.ts < 60 * 60 * 1000;
  });
  return cached?.filter((notification) => !isHiddenType(notification.type)) ?? null;
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
  useEffect(() => {
    setToastArchiveUser(user?.id ?? null);
  }, [user?.id]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (user) return getCached(user.id) || [];
    return getCachedBeforeAuth() || [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    const seed = user ? getCached(user.id) : getCachedBeforeAuth();
    return (seed || []).filter(n => !n.is_read).length;
  });

  // Har vi någon gång sett ett inloggat konto? Först då betyder `user === null`
  // utloggning/kontobyte. Vid uppstart betyder det bara "auth är inte klar än",
  // och då ska den förvärmda badgen få ligga kvar.
  const hasHadUserRef = useRef(false);

  // Hydrate from cache on user change
  useEffect(() => {
    if (!user) {
      if (!hasHadUserRef.current) return; // auth laddar fortfarande
      // Vid utloggning/kontobyte får föregående kontos notiser aldrig ligga kvar
      // i klockan.
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    hasHadUserRef.current = true;
    const cached = getCached(user.id);
    if (cached) {
      setNotifications(cached);
      setUnreadCount(cached.filter(n => !n.is_read).length);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Typer där användaren själv stängt av in-app-notiser. Raden finns kvar i
  // databasen (push/mejl styrs separat), men klockan ska hållas tyst.
  const mutedTypesRef = useRef<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const notificationsRef = useRef<AppNotification[]>([]);
  const broadcastRef = useRef<RealtimeChannel | null>(null);
  // Ett hämtningsfel får aldrig se ut som "Inga notifikationer".
  const [hasError, setHasError] = useState(false);

  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

  const loadMutedTypes = useCallback(async (): Promise<Set<string>> => {
    if (!user) return mutedTypesRef.current;
    const { data } = await supabase
      .from('notification_preferences')
      .select('notification_type, in_app_enabled')
      .eq('user_id', user.id);
    const next = new Set(
      (data ?? []).filter((p) => p.in_app_enabled === false).map((p) => p.notification_type)
    );
    mutedTypesRef.current = next;
    return next;
  }, [user]);

  // Skyddar mot att en avstängd typ triggar oändliga omhämtningar.
  const mutedRetryRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      // Tidigare väntade vi på avstängda typer INNAN notiserna ens började
      // hämtas — ett extra serverhopp framför varje laddning. Nu körs alla tre
      // frågorna parallellt med senast kända avstängda typer, och skulle de ha
      // ändrats görs exakt en omhämtning.
      const knownMuted = new Set(mutedTypesRef.current);
      const mutedPromise = loadMutedTypes();
      const excluded = Array.from(new Set([...knownMuted, ...HIDDEN_TYPES]));
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id);
      if (excluded.length) query = query.not('type', 'in', `(${excluded.join(',')})`);

      const [{ data, error }, countRes, freshMuted] = await Promise.all([
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
        mutedPromise.catch(() => knownMuted),
      ]);

      if (error) throw error;
      const items = (data || []) as AppNotification[];
      setNotifications(items);
      // Räknaren kommer från servern — den får aldrig begränsas av hur många
      // sidor som råkar vara laddade i klockan.
      setUnreadCount(countRes.count ?? items.filter(n => !n.is_read).length);
      setHasMore(items.length === PAGE_SIZE);
      setCache(user.id, items);
      setHasError(false);

      const changed =
        freshMuted.size !== knownMuted.size ||
        Array.from(freshMuted).some((t) => !knownMuted.has(t));
      if (changed && !mutedRetryRef.current) {
        mutedRetryRef.current = true;
        try {
          await fetchNotificationsRef.current?.();
        } finally {
          mutedRetryRef.current = false;
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setHasError(true);
    }
  }, [user, loadMutedTypes]);

  const fetchNotificationsRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

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
        .or(`created_at.lt."${last.created_at}",and(created_at.eq."${last.created_at}",id.lt.${last.id})`);
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

    // Topic "user:<uid>" + privat kanal: Realtime Authorization (RLS på
    // realtime.messages) släpper bara in ägaren — broadcast-synken mellan
    // användarens enheter kan därmed varken avlyssnas eller förfalskas.
    const channel = createRealtimeChannel(`user:${user.id}`, { config: { private: true } })
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
            const before = prev.find(n => n.id === updatedNotif.id);
            const updated = prev.map(n => (n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n));
            setCache(user.id, updated);
            // Justera räknaren med skillnaden i stället för att räkna om de
            // laddade sidorna — annars tappas olästa notiser utanför sidan.
            if (before && before.is_read !== updatedNotif.is_read) {
              setUnreadCount(prev2 => Math.max(0, prev2 + (updatedNotif.is_read ? -1 : 1)));
            }
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
            const before = prev.find(n => n.id === removed.id);
            if (!before) return prev;
            const updated = prev.filter(n => n.id !== removed.id);
            setCache(user.id, updated);
            if (!before.is_read) setUnreadCount(prev2 => Math.max(0, prev2 - 1));
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

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    // Misslyckas skrivningen (offline/fel) får vyn inte ljuga om att notisen
    // är läst — återställ den optimistiska ändringen.
    if (error) {
      setNotifications(prev => {
        const reverted = prev.map(n => n.id === notificationId ? { ...n, is_read: false } : n);
        setCache(user.id, reverted);
        return reverted;
      });
      setUnreadCount(prev => prev + 1);
    }
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

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    // Gick skrivningen inte igenom ska listan hämtas om i stället för att
    // visa allt som läst och sprida det till andra enheter.
    if (error) {
      await fetchNotifications();
      return;
    }

    void broadcastRef.current?.send({ type: 'broadcast', event: 'local_read_all', payload: {} });
  }, [user, fetchNotifications]);

  const clearAll = useCallback(async () => {
    if (!user) return;

    setNotifications([]);
    setUnreadCount(0);
    setCache(user.id, []);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    // Rensningen får inte spridas till andra enheter om den aldrig gick igenom.
    if (error) {
      await fetchNotifications();
      return;
    }

    void broadcastRef.current?.send({ type: 'broadcast', event: 'local_clear', payload: {} });
  }, [user, fetchNotifications]);

  return {
    notifications,
    hasMore,
    isLoadingMore,
    loadMore,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    hasError,
    refetch: fetchNotifications,
  };
}
