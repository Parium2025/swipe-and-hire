/**
 * Audience Landing preload — säkerställer att /jobbsokare och /arbetsgivare
 * får samma snabba LCP. Lägger till <link rel="preload"> för första
 * gallery-bilden + dekodar de tunga assetsen i bakgrunden.
 *
 * Helt additivt. Kör en gång per sida. Inga UI-bieffekter.
 */
import realPosters from '@/assets/landing/jobseeker-real-1.jpg';
import realPoster2 from '@/assets/landing/jobseeker-real-2.jpg';

let started = false;

const addLink = (rel: string, href: string, as?: string, priority?: 'high' | 'low') => {
  if (typeof document === 'undefined') return;
  const exists = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)).some(
    (l) => l.getAttribute('href') === href,
  );
  if (exists) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (as) link.as = as;
  if (priority) link.setAttribute('fetchpriority', priority);
  if (rel === 'prefetch') link.setAttribute('crossorigin', '');
  document.head.appendChild(link);
};

const decode = (url: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    (img as HTMLImageElement & { fetchPriority?: 'high' | 'low' }).fetchPriority = 'low';
    img.onload = () => (typeof img.decode === 'function' ? img.decode().then(() => resolve()).catch(() => resolve()) : resolve());
    img.onerror = () => resolve();
    img.src = url;
  });

export const preloadAudienceLandingAssets = () => {
  if (started || typeof window === 'undefined') return;
  started = true;

  // 1. Första gallery-postern: high-priority preload (LCP-kandidat under hero).
  addLink('preload', realPosters, 'image', 'high');
  addLink('preload', realPoster2, 'image', 'low');

  // 2. Dekoda bilderna i bakgrunden (idle).
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  const run = () => {
    decode(realPosters);
    decode(realPoster2);
  };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run);
  else window.setTimeout(run, 600);
};
