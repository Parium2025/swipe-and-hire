import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarRoutePrefetch } from '@/hooks/useSidebarRoutePrefetch';
import { getIsOnline } from '@/lib/connectivityManager';

/**
 * ❄️ KALLSTART — ARBETSGIVARENS ANNONSSIDOR
 *
 * Kandidater, chattar, support, inställningar och statistik värms redan.
 * Kvar var "Mina annonser" och "Företagets annonser": de hämtades först vid
 * hover i sidomenyn, så det allra första besöket efter inloggning visade
 * skelett.
 *
 * Här körs exakt samma prefetch som hover-varianten (samma query-nycklar,
 * samma hämtare, samma spärr mot att skriva över en redan komplett lista) —
 * men i idle direkt efter inloggning, sekventiellt så vi aldrig konkurrerar
 * med kandidatförvärmningen om bandbredd.
 */
const ROUTES = ['/my-jobs', '/dashboard'];
const DELAY_BETWEEN_MS = 400;

export function useEmployerPagePrewarm() {
  const { user, userRole } = useAuth();
  const prefetchRoute = useSidebarRoutePrefetch();
  const isEmployer = userRole?.role === 'employer';
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !isEmployer || !getIsOnline()) return;

    let cancelled = false;
    const timers: number[] = [];

    const run = () => {
      ROUTES.forEach((url, i) => {
        const t = window.setTimeout(() => {
          if (cancelled) return;
          prefetchRoute(url);
        }, i * DELAY_BETWEEN_MS);
        timers.push(t);
      });
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => run(), { timeout: 2500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
        timers.forEach((t) => window.clearTimeout(t));
      };
    }

    const id = window.setTimeout(run, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [userId, isEmployer, prefetchRoute]);
}
