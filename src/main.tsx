import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'

import './index.css'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { initSyncEngine } from './lib/offlineSyncEngine'
import { installBfcacheGuard, persistBuildSignature } from './lib/appReloader'
import { installVersionWatcher } from './lib/versionWatcher'
import { installServiceWorkerBuildHandshake } from './lib/serviceWorkerManager'
import pariumLogoRings from './assets/parium-logo-rings.png'
import { AUTH_LOGO_URL } from './assets/authLogo'
import { initializeAuthBootstrapCredentials } from './lib/authBootstrapCredentials'

// Installed before React bootstrap so a new worker can safely identify this
// build and only migrate genuinely old, destructive multi-tab clients.
installServiceWorkerBuildHandshake();

// Preload + decode critical UI assets ASAP (before React mounts)
const preloadAndDecodeImage = async (src: string, id: string) => {
  try {
    const isDataUri = typeof src === 'string' && src.startsWith('data:');

    // Add a preload hint (helps the browser start fetching earlier)
    // Skip for data URIs to avoid bloating <head>.
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

    // Fetch + decode into memory cache
    const img = new Image();
    img.src = src;
    // decode() ensures it's ready to paint immediately when the element mounts
    if (typeof img.decode === 'function') {
      await img.decode();
    }
  } catch {
    // Never block app start for a preload
  }
};


async function bootstrap() {
  // The first inline head script has already removed every auth credential
  // from the address bar. Transfer its one-time payload before App mounts.
  initializeAuthBootstrapCredentials();

  // 🛡️ Installera bfcache-guard (iOS Safari back/forward cache → silent reload vid stale bundle)
  installBfcacheGuard();

  // 🔄 Spotify-style version watcher: visibility-check + 5min heartbeat → silent deferred reload
  installVersionWatcher();

  const isPreviewHost = (() => {
    try {
      return typeof window !== 'undefined' && window.location.hostname.includes('id-preview--');
    } catch {
      return false;
    }
  })();

  // 🔥 CRITICAL: ALWAYS preload AND DECODE the auth logo immediately, regardless of current route.
  // This ensures the logo is already in browser memory when user logs out and navigates to /auth.
  // On /auth route we block until decoded; on other routes we still decode but don't block.
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isAuthRoute = currentPath === '/auth';
  const isPublicLandingRoute = currentPath === '/';

  // 🚀 Warm up Spline-runtime chunk PARALLELLT med React-bootstrap för routes
  // som faktiskt visar 3D-telefonen. Utan denna rad startar import först när
  // SplinePhone-komponenten mountar (efter hydration) → 300–600 ms långsammare
  // första frame. Ingen UX-ändring — exakt samma kod, bara tidigare i tiden.
  if (currentPath === '/jobbsokare' || currentPath === '/arbetsgivare') {
    void import('@splinetool/runtime').catch(() => { /* SplinePhone har egen fallback */ });
  }

  // Start both preloads immediately (parallel)
  const authLogoPromise = preloadAndDecodeImage(AUTH_LOGO_URL, 'auth-logo');
  const warmNavigationLogo = () => {
    void preloadAndDecodeImage(pariumLogoRings, 'nav-logo');
  };

  // Auth already has a high-priority splash image. Let that critical request
  // finish before warming the post-login navigation logo on slow connections.
  if (isAuthRoute) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(warmNavigationLogo, { timeout: 2_000 });
    } else {
      globalThis.setTimeout(warmNavigationLogo, 1_500);
    }
  } else {
    warmNavigationLogo();
  }

  // On /auth, wait for logo to be fully decoded before rendering
  if (isAuthRoute) {
    await authLogoPromise;
  }

  // Initialize the offline sync engine (works without SW; background sync is best-effort only)
  initSyncEngine();

  const { default: App } = await import('./App');
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <GlobalErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </GlobalErrorBoundary>
  );

  setTimeout(() => {
    persistBuildSignature();
  }, 0);
}

void bootstrap();
