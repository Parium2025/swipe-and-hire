// ported from main.tsx — client-side bootstrap that used to run before React
// mounted in the old SPA entry. Now runs once on first import of __root.tsx
// in the browser. Nothing here may ever block or crash app startup.
import { initSyncEngine } from '@/lib/offlineSyncEngine';
import { nukeStaleCaches } from '@/lib/cacheNuke';
import { forceServiceWorkerReset } from '@/lib/swForceReset';
import { installBfcacheGuard, persistBuildSignature } from '@/lib/appReloader';
import { cleanupOldDrafts } from '@/lib/draftUtils';
import pariumLogoRings from '@/assets/parium-logo-rings.png';
import authLogoDataUri from '@/assets/parium-auth-logo.png?inline';

// Preload + decode critical UI assets ASAP (before hydration completes)
const preloadAndDecodeImage = async (src: string, id: string) => {
  try {
    const isDataUri = typeof src === 'string' && src.startsWith('data:');
    if (!isDataUri && typeof document !== 'undefined' && document.head) {
      const existing = document.querySelector(`link[data-preload-logo="${id}"]`) as HTMLLinkElement | null;
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        link.setAttribute('data-preload-logo', id);
        document.head.appendChild(link);
      }
    }
    const img = new Image();
    img.src = src;
    if ('decode' in img && typeof (img as unknown as { decode?: () => Promise<void> }).decode === 'function') {
      await (img as unknown as { decode: () => Promise<void> }).decode();
    }
  } catch {
    // Never block app start for a preload
  }
};

function redirectAuthTokensIfNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  const { location } = window;
  const pathname = location.pathname;

  // Sidor med EGNA ?token=-parametrar (avprenumerationslänkar i mejl) får
  // aldrig kapas hit — annars blir det en extra full sidladdning till /auth
  // med blank skärm och splash-blink direkt från inkorgen.
  if (
    pathname === '/unsubscribe' ||
    pathname === '/unsubscribe/' ||
    /^\/oauth\/(google_calendar|microsoft_outlook)\/return\/?$/.test(pathname)
  ) return false;

  const search = new URLSearchParams(location.search);
  const hashStr = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const hash = new URLSearchParams(hashStr);

  // Äldre utskick länkar till /?token=<64 hex> eller /auth?token=<64 hex>.
  // Identifiera dem synkront före React och auth-splashen hinner starta.
  const legacyUnsubscribeToken = search.get('token') || '';
  if (
    !search.get('type') &&
    !search.get('token_hash') &&
    !hash.get('access_token') &&
    !hash.get('refresh_token') &&
    /^[a-f0-9]{64}$/i.test(legacyUnsubscribeToken)
  ) {
    location.replace(`${location.origin}/unsubscribe?token=${encodeURIComponent(legacyUnsubscribeToken)}`);
    return true;
  }

  // Only redirect when not already on /auth
  if (pathname === '/auth') return false;

  const type = hash.get('type') || search.get('type');
  const token = hash.get('token') || search.get('token');
  const tokenHash = hash.get('token_hash') || search.get('token_hash');
  const accessToken = hash.get('access_token') || search.get('access_token');
  const refreshToken = hash.get('refresh_token') || search.get('refresh_token');
  const errorCode = hash.get('error_code') || search.get('error_code') || hash.get('error') || search.get('error');
  const errorDesc = hash.get('error_description') || search.get('error_description') || hash.get('error_message') || search.get('error_message');

  const hasAccessPair = !!(accessToken && refreshToken);
  const hasToken = !!(token || tokenHash);
  const isRecoveryFlow = (type === 'recovery') || hasAccessPair || hasToken || !!errorCode || !!errorDesc;

  if (isRecoveryFlow) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (tokenHash) params.set('token_hash', tokenHash);
    if (token && !tokenHash) params.set('token', token);
    if (accessToken) params.set('access_token', accessToken);
    if (refreshToken) params.set('refresh_token', refreshToken);
    if (errorCode) params.set('error_code', errorCode);
    if (errorDesc) params.set('error_description', errorDesc);

    location.replace(`${location.origin}/auth?${params.toString()}`);
    return true;
  }
  return false;
}

let started = false;

export function initClientBootstrap(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const redirected = redirectAuthTokensIfNeeded();
  if (redirected) return;

  // Inget av stegen nedan får kunna stoppa själva appstarten.
  try {
    // 🧹 Nuke stale caches from before the "single tunnel" architecture.
    nukeStaleCaches();
    // 🔁 Engångs-tvångsrensning av gammal Service Worker + Cache Storage.
    forceServiceWorkerReset();
    // 🛡️ bfcache-guard (iOS Safari back/forward cache → silent reload vid stale bundle)
    installBfcacheGuard();
    // OBS: installVersionWatcher() är INTE portad — den byggde på version.json
    // från gamla Vite-SPA-bygget. TanStack Start-servern renderar alltid färsk HTML.
  } catch {
    /* aldrig blockera starten */
  }

  const currentPath = window.location.pathname;

  // 🚀 Warm up Spline-runtime chunk parallellt med hydration för routes
  // som faktiskt visar 3D-telefonen.
  if (currentPath === '/jobbsokare' || currentPath === '/arbetsgivare') {
    // import.meta.env.SSR låter SSR-bygget skära bort Spline-runtimen helt —
    // den kör `new Function` vid modul-evaluering och kraschar edge/SSR.
    if (!import.meta.env.SSR) void import('@splinetool/runtime').catch(() => { /* SplinePhone har egen fallback */ });
  }

  // Start both logo preloads immediately (parallel, never awaited)
  void preloadAndDecodeImage(authLogoDataUri, 'auth-logo');
  void preloadAndDecodeImage(pariumLogoRings, 'nav-logo');

  // Initialize the offline sync engine (best-effort background sync)
  try { initSyncEngine(); } catch { /* aldrig blockera starten */ }

  // Run draft cleanup once on app load (removes drafts older than 1 day),
  // deferred to idle time to avoid blocking first paint.
  const runCleanup = () => cleanupOldDrafts(24 * 60 * 60 * 1000);
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(runCleanup, { timeout: 3000 });
  } else {
    setTimeout(runCleanup, 1000);
  }

  setTimeout(() => {
    try { persistBuildSignature(); } catch { /* noop */ }
  }, 0);
}
