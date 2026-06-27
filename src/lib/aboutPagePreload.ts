import bannerAsset from '@/assets/om-oss-banner.png.asset.json';

export const ABOUT_BANNER_URL = bannerAsset.url;

let aboutAssetsPromise: Promise<void> | null = null;

const addPreloadLink = (url: string, priority: 'high' | 'low') => {
  if (typeof document === 'undefined') return;

  const existing = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]'),
  ).some((link) => {
    try {
      return new URL(link.href, window.location.origin).pathname === new URL(url, window.location.origin).pathname;
    } catch {
      return link.getAttribute('href') === url;
    }
  });

  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  link.setAttribute('fetchpriority', priority);
  document.head.appendChild(link);
};

const decodeImage = (url: string, priority: 'high' | 'low') =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    (img as HTMLImageElement & { fetchPriority?: 'high' | 'low' }).fetchPriority = priority;
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(() => resolve()).catch(() => resolve());
        return;
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });

export const preloadAboutPageAssets = (priority: 'high' | 'low' = 'low') => {
  if (typeof window === 'undefined') return Promise.resolve();

  addPreloadLink(ABOUT_BANNER_URL, priority);

  if (!aboutAssetsPromise) {
    aboutAssetsPromise = decodeImage(ABOUT_BANNER_URL, priority);
  }

  return aboutAssetsPromise;
};