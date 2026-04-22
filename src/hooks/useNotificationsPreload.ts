import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * 🔔 NOTIFICATIONS PRELOAD
 *
 * Tyst preloader som fyller localStorage-cachen som useNotifications
 * redan läser ifrån. Eftersom useNotifications hydrerar från
 * `parium_notifications_cache` synkront vid mount betyder det att efter
 * första preloaden visas notifikationerna INSTANT på alla framtida sidladdningar
 * – ingen spinner, ingen popping.
 *
 * Strategi:
 *  - Kör efter att appen är mountad (queueMicrotask + idle)
 *  - Skriver ENDAST till localStorage (samma key som useNotifications)
 *  - Rör inte React-state → 0 re-renders
 *  - Tysta fails (catch noop)
 *  - Gör inget om cachen är färsk (<5 min) — useNotifications uppdaterar
 *    själv via realtime + visibilitychange
 *
 * Säkerhet: Helt additivt. Befintlig useNotifications-logik orörd.
 */

const CACHE_KEY = 'parium_notifications_cache';
const FRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

interface CachedShape {
  userId: string;
  ts: number;
  items: unknown[];
}

function isCacheFresh(userId: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as CachedShape;
    if (parsed.userId !== userId) return false;
    return Date.now() - parsed.ts < FRESH_THRESHOLD_MS;
  } catch {
    return false;
  }
}

export function useNotificationsPreload() {
  const { user } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    if (isCacheFresh(user.id)) return;

    const userId = user.id;

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error || !data) return;

        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ userId, items: data, ts: Date.now() }),
          );
        } catch {
          // Ignore quota errors
        }
      } catch {
        // Tyst fail — best effort
      }
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(() => void run(), { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(() => void run(), 1500);
    }

    return () => {
      if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [user]);
}
