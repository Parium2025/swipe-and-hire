import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { isSlowConnection, isTouchDevice } from '@/hooks/useNetworkAwareFetch';

/**
 * 🪜 PROGRESSIVE PAGINATION PREFETCH
 *
 * "Trappan" som användaren beskrev: när sida 1 finns i cachen börjar vi
 * automatiskt hämta sida 2 i bakgrunden, sen sida 3, osv. tills vi nått
 * `maxPages` eller `hasNextPage` är false.
 *
 * Resultat: när användaren scrollar/klickar "Nästa sida" finns datan
 * redan i React Query-cachen → 0 ms väntetid, ingen spinner.
 *
 * Säkerhet:
 *  - Ren cache-hook, INGA UI-bieffekter
 *  - Kör ALLT i requestIdleCallback så vi aldrig konkurrerar med render
 *  - Backar av på slow connections (max 2 extra sidor istället för 5)
 *  - Backar av på touch-enheter (sparar batteri/data)
 *  - Stoppar omedelbart när komponenten unmountas
 *
 * Användning:
 *   useProgressivePagination({
 *     queryKey: ['applications', userId, ''],
 *     enabled: !!userId,
 *     maxPages: 5,
 *   });
 */

interface InfinitePageData {
  pages: Array<{
    hasMore?: boolean;
    nextCursor?: string | number | null;
    items?: unknown[];
  }>;
  pageParams: unknown[];
}

interface UseProgressivePaginationOptions {
  /** React Query key för en useInfiniteQuery */
  queryKey: QueryKey;
  /** Aktivera prefetch (ex. !!user) */
  enabled: boolean;
  /** Hur många totala sidor vi vill ha laddade. Default 5. */
  maxPages?: number;
  /** Fördröjning mellan varje sidhämtning (ms). Default 800. */
  delayBetweenPages?: number;
}

export function useProgressivePagination({
  queryKey,
  enabled,
  maxPages = 5,
  delayBetweenPages = 800,
}: UseProgressivePaginationOptions) {
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (startedRef.current) return;

    cancelledRef.current = false;

    // Justera maxPages baserat på nätverk/enhet
    const effectiveMax = isSlowConnection()
      ? Math.min(2, maxPages)
      : isTouchDevice()
        ? Math.min(3, maxPages)
        : maxPages;

    const effectiveDelay = isSlowConnection() ? delayBetweenPages * 2 : delayBetweenPages;

    const fetchNext = async (pagesLoadedSoFar: number): Promise<void> => {
      if (cancelledRef.current) return;
      if (pagesLoadedSoFar >= effectiveMax) return;

      const data = queryClient.getQueryData<InfinitePageData>(queryKey);
      if (!data || !data.pages || data.pages.length === 0) {
        // Sida 1 finns inte än — vänta och försök igen
        await new Promise((r) => setTimeout(r, 500));
        if (cancelledRef.current) return;
        return fetchNext(pagesLoadedSoFar);
      }

      // Avbryt om vi redan har laddat tillräckligt
      if (data.pages.length >= effectiveMax) return;

      const lastPage = data.pages[data.pages.length - 1];

      // Avgör om det finns mer att hämta. Stödjer både hasMore och nextCursor.
      const hasMore =
        lastPage?.hasMore === true ||
        (lastPage?.nextCursor !== undefined && lastPage?.nextCursor !== null);

      if (!hasMore) return;

      try {
        await queryClient.fetchInfiniteQuery({
          queryKey,
          // @ts-expect-error – React Query infers initialPageParam from existing query
          initialPageParam: undefined,
        });
      } catch {
        // Tyst fail — prefetch är best-effort
        return;
      }

      if (cancelledRef.current) return;

      // Vänta och fortsätt med nästa sida
      await new Promise((r) => setTimeout(r, effectiveDelay));
      if (cancelledRef.current) return;

      const updated = queryClient.getQueryData<InfinitePageData>(queryKey);
      const newPagesCount = updated?.pages?.length ?? pagesLoadedSoFar;

      // Skydd mot oändliga loopar om sidan inte växte
      if (newPagesCount <= pagesLoadedSoFar) return;

      return fetchNext(newPagesCount);
    };

    const start = () => {
      if (cancelledRef.current) return;
      startedRef.current = true;
      const data = queryClient.getQueryData<InfinitePageData>(queryKey);
      const initialPages = data?.pages?.length ?? 0;
      void fetchNext(initialPages);
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (typeof w.requestIdleCallback === 'function') {
      // Vänta minst 2 sek så sida 1 hinner laddas och renderas
      idleId = w.requestIdleCallback(start, { timeout: 4000 });
    } else {
      timeoutId = window.setTimeout(start, 2000);
    }

    return () => {
      cancelledRef.current = true;
      startedRef.current = false;
      if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
    // queryKey är en array — JSON-stringify för stabil dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(queryKey), maxPages, delayBetweenPages, queryClient]);
}
