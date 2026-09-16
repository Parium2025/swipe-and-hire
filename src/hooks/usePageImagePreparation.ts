import { useCallback, useEffect, useMemo } from 'react';
import { imageCache } from '@/lib/imageCache';

type GetImageUrls<T> = (item: T) => Array<string | null | undefined>;

/**
 * Gemensam bildberedskap för sidnumrerade listor.
 *
 * Förvärmer aktuell och angränsande sida med exakt de URL:er korten renderar.
 * preparePage används som en spärr före hissrörelsen och löser först när alla
 * målsidans bilder är hämtade och avkodade i imageCache.
 */
export function usePageImagePreparation<T>(
  items: T[],
  page: number,
  pageSize: number,
  getImageUrls: GetImageUrls<T>,
) {
  const urlsByPage = useCallback((targetPage: number) => {
    const start = Math.max(0, (targetPage - 1) * pageSize);
    return [...new Set(
      items
        .slice(start, start + pageSize)
        .flatMap(getImageUrls)
        .filter((url): url is string => Boolean(url)),
    )];
  }, [getImageUrls, items, pageSize]);

  const neighbourUrls = useMemo(
    () => [...new Set([page - 1, page, page + 1]
      .filter((targetPage) => targetPage >= 1)
      .flatMap(urlsByPage))],
    [page, urlsByPage],
  );

  useEffect(() => {
    if (neighbourUrls.length === 0) return;
    void imageCache.preloadImages(neighbourUrls);
  }, [neighbourUrls]);

  return useCallback(async (targetPage: number) => {
    const urls = urlsByPage(targetPage);
    if (urls.length === 0) return;
    await imageCache.preloadImages(urls);
  }, [urlsByPage]);
}