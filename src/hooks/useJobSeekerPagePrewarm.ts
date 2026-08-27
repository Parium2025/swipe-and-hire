import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchSavedJobsForUser, fetchSkippedJobsForUser } from '@/hooks/useSavedJobsCache';
import { fetchMyApplicationsForUser } from '@/hooks/useMyApplicationsCache';
import { getIsOnline } from '@/lib/connectivityManager';

/**
 * ❄️ KALLSTART — SPARADE JOBB & MINA ANSÖKNINGAR
 *
 * Sidorna laddar redan instant när localStorage-cachen är varm. Vid första
 * besöket efter inloggning finns ingen cache, och då blinkar skelettet till.
 * Här hämtas listorna i idle direkt efter inloggning med EXAKT samma
 * query-nycklar och hämtare som sidorna själva använder — resultatet
 * återanvänds 1:1 och localStorage-cachen skrivs samtidigt.
 *
 * Säkerhet:
 *  - Skriver aldrig över data som redan finns i cachen.
 *  - Körs sekventiellt i idle så första sidan inte konkurrerar om bandbredd.
 *  - Felar tyst — sidan hämtar själv vid behov.
 */
export function useJobSeekerPagePrewarm() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !getIsOnline()) return;
    let cancelled = false;

    const warm = async <T,>(queryKey: unknown[], queryFn: () => Promise<T>) => {
      if (cancelled) return;
      if (queryClient.getQueryData(queryKey)) return;
      try {
        await queryClient.prefetchQuery({ queryKey, queryFn, staleTime: 60_000 });
      } catch {
        // Tyst — sidan hämtar själv.
      }
    };

    const run = async () => {
      await warm(['my-applications', userId], () => fetchMyApplicationsForUser(userId));
      // Intervjusektionen ligger ÖVANFÖR ansökningarna — utan förvärmning
      // puttas listan nedåt när intervjuerna landar (upplevs som en blixt).
      await warm(['candidate-interviews', userId], () => fetchCandidateInterviewsForUser(userId));
      await warm(['saved-jobs', userId], () => fetchSavedJobsForUser(userId));
      await warm(['skipped-jobs', userId], () => fetchSkippedJobsForUser(userId));
    };


    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => { void run(); }, { timeout: 2500 });
      return () => { cancelled = true; w.cancelIdleCallback?.(id); };
    }

    const id = window.setTimeout(() => { void run(); }, 500);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [userId, queryClient]);
}
