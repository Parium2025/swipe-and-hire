import { useCallback, useEffect, useMemo } from 'react';
import { imageCache } from '@/lib/imageCache';

type GetImageUrls<T> = (item: T) => Array<string | null | undefined>;

const waitForPaint = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

async function primeRenderedPixels(urls: string[]) {
  const cachedUrls = urls
    .map((url) => imageCache.getCachedUrl(url))
    .filter((url): url is string => Boolean(url));
  if (cachedUrls.length === 0) return;

  const rack = document.createElement('div');
  rack.setAttribute('aria-hidden', 'true');
  rack.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;';
  document.body.appendChild(rack);

  try {
    await Promise.all(cachedUrls.map((src) => new Promise<void>((resolve) => {
      const image = document.createElement('img');
      image.decoding = 'sync';
      image.width = 1;
      image.height = 1;
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = src;
      rack.appendChild(image);
      if (image.complete && image.naturalWidth > 0) resolve();
    })));
    await waitForPaint();
  } finally {
    rack.remove();
  }
}

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
    await imageCache.preloadImages(urls, true);
    await primeRenderedPixels(urls);
  }, [urlsByPage]);
}