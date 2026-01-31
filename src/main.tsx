import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { registerServiceWorker } from './lib/serviceWorkerManager'
import pariumLogoRings from './assets/parium-logo-rings.png'

// Auth page logo (public) - blue text on dark background
const authLogoUrl = '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

// Alternative logo (white version for dark backgrounds - used in ProfileSelector, ProfileBuilder)
const altLogoUrl = '/lovable-uploads/3e52da4e-167e-4ebf-acfb-6a70a68cfaef.png';

// Preload + decode critical UI assets ASAP (before React mounts)
const preloadAndDecodeImage = async (src: string) => {
  try {
    // Add a preload hint (helps the browser start fetching earlier)
    if (typeof document !== 'undefined' && document.head) {
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

// Fire-and-forget: ensures auth page logo is instantly ready even after logout/reload
void preloadAndDecodeImage(authLogoUrl);

// Fire-and-forget: ensures alternative white logo is ready (ProfileSelector, ProfileBuilder)
void preloadAndDecodeImage(altLogoUrl);

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

const redirected = redirectAuthTokensIfNeeded();
if (!redirected) {
  // Registrera Service Worker endast i produktion för att undvika störande reloads i utveckling
  if (import.meta.env.PROD) {
    registerServiceWorker().catch(() => {
      // Silent fail - SW is optional enhancement
    });
  }

  const root = createRoot(document.getElementById("root")!);
  root.render(
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
}

