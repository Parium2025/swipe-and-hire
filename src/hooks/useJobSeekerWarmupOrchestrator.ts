import { useJobSeekerMediaWarmup } from '@/hooks/useJobSeekerMediaWarmup';
import { useJobSearchProgressivePagination } from '@/hooks/useJobSearchProgressivePagination';
import { useNotificationsPreload } from '@/hooks/useNotificationsPreload';

/**
 * 🚀 JOB SEEKER WARMUP ORCHESTRATOR
 *
 * Spegel av useEmployerWarmupOrchestrator för jobbsökarsidan.
 * Wirar upp:
 *
 *  1. Mediawarmup för logos i ['my-applications'], ['available-jobs'],
 *     ['optimized-job-search'] och avatars i ['conversations'].
 *  2. Trappa-prefetch på aktiv optimized-job-search-query — så att
 *     sida 2/3 redan finns i cachen när användaren scrollar.
 *  3. Notifikations-preload — fyller localStorage-cachen så
 *     NotificationCenter öppnas instant utan spinner.
 *
 * Befintlig logik (useJobSeekerBackgroundSync, realtime-subscriptions,
 * useGlobalImagePreloader, useNotifications) rörs INTE — rent additivt.
 *
 * Säkerhet:
 *  - 0 UI/UX-påverkan
 *  - Backar av på touch / slow connections
 *  - Tysta fails
 */
export function useJobSeekerWarmupOrchestrator() {
  useJobSeekerMediaWarmup();
  useJobSearchProgressivePagination();
  useNotificationsPreload();
}
