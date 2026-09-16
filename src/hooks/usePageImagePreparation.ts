import { useCallback, useEffect, useMemo } from 'react';
import { imageCache } from '@/lib/imageCache';

type GetImageUrls<T> = (item: T) => Array<string | null | undefined>;

const waitForPaint = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

async function decodeAtRenderedSize(src: string, width: number, height: number) {
  const image = document.createElement('img');
  image.decoding = 'sync';
  image.width = width;
  image.height = height;
  image.style.cssText = `display:block;width:${width}px;height:${height}px;object-fit:cover;`;
  image.src = src;

  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    if (image.complete) resolve();
  });
  if (image.naturalWidth > 0 && typeof image.decode === 'function') {
    await image.decode().catch(() => undefined);
  }
  return image;
}

async function primeRenderedPixels(urls: string[]) {
  const cachedUrls = urls.flatMap((url) => {
    const cached = imageCache.getCachedUrl(url);
    return cached ? [{ source: url, cached }] : [];
  });
  if (cachedUrls.length === 0) return;

  const rack = document.createElement('div');
  rack.setAttribute('aria-hidden', 'true');
  rack.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;overflow:hidden;pointer-events:none;visibility:hidden;';
  document.body.appendChild(rack);

  try {
    const images = await Promise.all(cachedUrls.map(({ source, cached }) => {
      const isLogo = source.includes('/company-logos/');
      return decodeAtRenderedSize(cached, isLogo ? 64 : 600, isLogo ? 64 : 300);
    }));
    images.forEach((image) => rack.appendChild(image));
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