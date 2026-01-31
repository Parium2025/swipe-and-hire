import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { registerServiceWorker } from './lib/serviceWorkerManager'
import { hydrateCriticalAssets } from './lib/criticalAssetCache'
import pariumLogoRings from './assets/parium-logo-rings.png'
import pariumAuthLogoInline from './assets/parium-auth-logo.png?inline'

// Auth page logo (public) - blue text on dark background
const authLogoUrl = '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

// Auth logo (inline data URI) - guarantees first-frame availability even on hard refresh
const authLogoInlineUrl = pariumAuthLogoInline;

// Alternative logo (white version for dark backgrounds - used in ProfileSelector, ProfileBuilder)
const altLogoUrl = '/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png';

// Preload + decode critical UI assets ASAP (before React mounts)
const preloadAndDecodeImage = async (src: string) => {
  try {
    // Don't create <link preload> for data URIs (can bloat DOM and provides no fetch benefit)
    const isDataUrl = typeof src === 'string' && src.startsWith('data:');

    // Add a preload hint (helps the browser start fetching earlier)
    if (!isDataUrl && typeof document !== 'undefined' && document.head) {
      const existing = document.querySelector(
        `link[rel="preload"][as="image"][href="${src}"]`
      ) as HTMLLinkElement | null;
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
      }
    }

    // Fetch + decode into memory cache
    const img = new Image();
    // Hint: keep priority high for critical UI assets
    try {
      img.fetchPriority = 'high';
    } catch {
      // ignore
    }
    img.src = src;
    // decode() ensures it's ready to paint immediately when the element mounts
    if ('decode' in img && typeof (img as any).decode === 'function') {
      await (img as any).decode();
    }
  } catch {
    // Never block app start for a preload
  }
};

// Fire-and-forget: ensures top nav logo is instantly ready on back navigation
void preloadAndDecodeImage(pariumLogoRings);

// Fire-and-forget: keeps auth logo decoded in memory for route changes
void preloadAndDecodeImage(authLogoInlineUrl);

// Fire-and-forget: ensures alternative white logo is ready (ProfileSelector, ProfileBuilder)
void preloadAndDecodeImage(altLogoUrl);

const PREAUTH_SPLASH_ID = 'preauth-splash';

function isReactAuthLogoReady(): boolean {
  if (typeof document === 'undefined') return false;
  // PariumAuthLogo renders as a <div role="img" aria-label="Parium" ... />
  const el = document.querySelector(
    'div[role="img"][aria-label="Parium"]'
  ) as HTMLDivElement | null;
  if (!el) return false;

  const rect = el.getBoundingClientRect();
  // Tailwind not loaded → width/height can be 0, which looks like the logo "loads in" later.
  if (rect.width < 40 || rect.height < 40) return false;

  // Ensure background-image is set (it is inline, but be defensive)
  const bg = getComputedStyle(el).backgroundImage || '';
  if (!bg || bg === 'none') return false;
  return true;
}

function schedulePreAuthSplashHandoff(timeoutMs: number = 4000) {
  if (typeof window === 'undefined') return;
  const start = performance.now();

  const tick = () => {
    // Remove once the real logo is ready, or after a timeout.
    if (isReactAuthLogoReady() || performance.now() - start > timeoutMs) {
      unmountPreAuthSplash();
      return;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function mountPreAuthSplash() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(PREAUTH_SPLASH_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = PREAUTH_SPLASH_ID;
    el.setAttribute('aria-hidden', 'true');
  }

  // Inline styles so this works even before Tailwind/CSS is parsed.
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    // Keep transparent so it never hides the form; we only want to mask the logo pop-in.
    background: 'transparent',
    paddingTop: 'clamp(72px, 16vh, 160px)',
  } as CSSStyleDeclaration);

  // Ensure an <img> exists so something paints even before Tailwind is parsed.
  let img = el.querySelector('img') as HTMLImageElement | null;
  if (!img) {
    img = document.createElement('img');
    el.appendChild(img);
  }

  img.src = authLogoInlineUrl;
  img.alt = '';
  img.decoding = 'sync';
  try {
    (img as any).fetchPriority = 'high';
  } catch {
    // ignore
  }
  Object.assign(img.style, {
    width: 'min(460px, 82vw)',
    height: 'auto',
    aspectRatio: '460 / 256',
    display: 'block',
    transform: 'translateZ(0)',
  } as CSSStyleDeclaration);

  if (!el.isConnected) {
    document.body.appendChild(el);
  }
}

function unmountPreAuthSplash() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(PREAUTH_SPLASH_ID);
  if (el?.parentNode) el.parentNode.removeChild(el);
}

// Initialize Sentry for error tracking in production
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://bc7456823e992b35ceb78455f6b6ff24@o4510693219237888.ingest.de.sentry.io/4510693244207184",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance monitoring - capture 10% of transactions
    tracesSampleRate: 0.1,
    // Session replay - capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

function redirectAuthTokensIfNeeded() {
  if (typeof window === 'undefined') return false;
  const { location } = window;
  const pathname = location.pathname;

  // Only redirect when not already on /auth
  if (pathname === '/auth') return false;

  const search = new URLSearchParams(location.search);
  const hashStr = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const hash = new URLSearchParams(hashStr);

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

    const target = `${location.origin}/auth?${params.toString()}`;
    location.replace(target);
    return true;
  }
  return false;
}

async function start() {
  const redirected = redirectAuthTokensIfNeeded();
  if (redirected) return;

  // Ensure there's ALWAYS something visible instantly on /auth,
  // even if the JS bundle/React mount is delayed.
  if (typeof window !== 'undefined' && window.location?.pathname === '/auth') {
    mountPreAuthSplash();
  }

  // Hydrate critical assets from CacheStorage into decoded blob: URLs BEFORE React mounts.
  // This makes the auth logo paint instantly on hard refresh (after SW has cached it).
  try {
    if (typeof window !== 'undefined' && window.location?.pathname === '/auth') {
      await hydrateCriticalAssets([authLogoUrl, altLogoUrl]);
    }
  } catch {
    // Never block app start for cache hydration
  }

  // If we land directly on /auth (hard refresh), ensure the logo is decoded
  // BEFORE React mounts so the very first paint already has it.
  try {
    if (typeof window !== 'undefined' && window.location?.pathname === '/auth') {
      await preloadAndDecodeImage(authLogoInlineUrl);
    }
  } catch {
    // Never block app start for a decode attempt
  }

  // Registrera Service Worker endast i produktion för att undvika störande reloads i utveckling
  if (import.meta.env.PROD) {
    registerServiceWorker().catch(() => {
      // Silent fail - SW is optional enhancement
    });
  }

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );

  // Keep the splash UNTIL the real auth logo is actually paintable.
  // This prevents the "splash disappears → empty space → logo pops in" effect
  // when Tailwind/CSS arrives a beat later.
  try {
    if (typeof window !== 'undefined' && window.location?.pathname === '/auth') {
      schedulePreAuthSplashHandoff(4500);
    } else {
      unmountPreAuthSplash();
    }
  } catch {
    // ignore
  }
}

void start();

