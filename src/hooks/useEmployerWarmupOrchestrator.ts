import { useAuth } from '@/hooks/useAuth';
import { useProgressivePagination } from '@/hooks/useProgressivePagination';
import { useEmployerMediaWarmup } from '@/hooks/useEmployerMediaWarmup';
import { useNotificationsPreload } from '@/hooks/useNotificationsPreload';

/**
 * 🚀 EMPLOYER WARMUP ORCHESTRATOR
 *
 * Slutgiltigt lager ovanpå `useEmployerBackgroundSync`, `useCandidateBackgroundSync`
 * och `useEmployerPrefetch`. När arbetsgivaren är inloggad börjar systemet
 * automatiskt:
 *
 *  1. Trappa: hämta sida 2/3/4/5 av ['applications'] och ['my-candidates']
 *     i bakgrunden, en sida i taget med 800 ms paus.
 *  2. Mediawarmup: blob-cacha alla profilbilder så fort de dyker upp i
 *     React Query-cachen (även från trappan ovan).
 *
 * Resultat:
 *  - /candidates och /my-candidates känns som native-app — inga laddspinners,
 *    inga "popping in"-bilder.
 *  - Scroll genom listor är instant eftersom 5 sidor (≈250 kandidater) finns
 *    i cachen redan när användaren öppnar sidan.
 *
 * Säkerhet:
 *  - Kostar nästan inget när det är tyst (lyssnar bara på cache-events)
 *  - Backar av på slow connections och touch-enheter (mindre prefetch)
 *  - Helt additivt — befintlig logik rörs inte
 */
export function useEmployerWarmupOrchestrator() {
  const { user, userRole } = useAuth();
  const isEmployer = userRole?.role === 'employer';
  const userId = user?.id;

  // Trappan: hämta upp till 5 sidor (≈250 items) i bakgrunden för
  // "Alla kandidater" och "Mina kandidater"
  useProgressivePagination({
    queryKey: ['applications', userId, ''],
    enabled: !!userId && isEmployer,
    maxPages: 5,
    delayBetweenPages: 800,
  });

  useProgressivePagination({
    queryKey: ['my-candidates', userId, ''],
    enabled: !!userId && isEmployer,
    maxPages: 5,
    delayBetweenPages: 800,
  });

  // Mediawarmup: profilbilder cachas så fort de dyker upp
  useEmployerMediaWarmup();
}
