import { isLowPowerDevice, prefersLightweightVideo } from '@/lib/videoPlatform';

export const SPLINE_SCENE_URL = '/spline/parium-phone-scene.splinecode';

export const shouldDeferSplineAssets = () => prefersLightweightVideo() || isLowPowerDevice();

export const prefetchSplineAssets = () => {
  if (typeof document === 'undefined') return;
  const exists = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"], link[rel="preload"]'))
    .some((link) => link.getAttribute('href') === SPLINE_SCENE_URL);
  if (!exists) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = SPLINE_SCENE_URL;
    document.head.appendChild(link);
  }
  if (!import.meta.env.SSR) void import('@splinetool/runtime').catch(() => undefined);
};