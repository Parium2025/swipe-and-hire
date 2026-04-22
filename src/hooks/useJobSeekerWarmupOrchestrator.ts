import { useJobSeekerMediaWarmup } from '@/hooks/useJobSeekerMediaWarmup';
import { useJobSearchProgressivePagination } from '@/hooks/useJobSearchProgressivePagination';

/**
 * 🚀 JOB SEEKER WARMUP ORCHESTRATOR
 *
 * Spegel av useEmployerWarmupOrchestrator för jobbsökarsidan.
 * Wirar upp:
 *
 *  1. Mediawarmup för logos i ['my-applications'], ['available-jobs'],
 *     ['optimized-job-search'] och avatars i ['conversations'] — så att
 *     /my-applications, /saved-jobs och /messages aldrig "poppar in" bilder.
 *  2. Trappa-prefetch på aktiv optimized-job-search-query — så att sida 2/3
 *     redan finns i cachen när användaren scrollar.
 *
 * Befintlig logik (useJobSeekerBackgroundSync, realtime-subscriptions,
 * useGlobalImagePreloader) rörs INTE — detta är ett rent additivt lager.
 *
 * Säkerhet:
 *  - 0 UI/UX-påverkan
 *  - Backar av på touch / slow connections
 *  - Tysta fails
 */
export function useJobSeekerWarmupOrchestrator() {
  useJobSeekerMediaWarmup();
  useJobSearchProgressivePagination();
}
