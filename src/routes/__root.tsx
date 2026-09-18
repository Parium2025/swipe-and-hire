import { useState, useEffect, useLayoutEffect, Suspense } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  redirect,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { HelmetProvider } from "react-helmet-async";

import appCss from "../styles.css?url";
import { initClientBootstrap } from "@/lib/clientBootstrap";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { PageLoader } from "@/components/ui/page-loader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLocation } from "@/lib/router-compat";
import { useUiLockGuard } from "@/hooks/useUiLockGuard";
import { AuthProvider } from "@/hooks/useAuth";
import { ConversationsProvider } from "@/contexts/ConversationsContext";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { Header } from "@/components/Header";
import AuthTokenBridge from "@/components/AuthTokenBridge";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { useGlobalImagePreloader } from "@/hooks/useGlobalImagePreloader";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { OnlineStatusProvider } from "@/components/OnlineStatusProvider";
import { SystemHealthPanel } from "@/components/SystemHealthPanel";
import { PushNotificationProvider } from "@/components/PushNotificationProvider";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { CriticalAssetPreloads } from "@/components/CriticalAssetPreloads";
import { AuthSplashScreen } from "@/components/AuthSplashScreen";
import { RealtimeKeepAlive } from "@/components/RealtimeKeepAlive";
import { OfflineQueueRunner } from "@/components/OfflineQueueRunner";
import { AppFailureMonitor } from "@/components/AppFailureMonitor";
import { syncBrowserChrome, mountChromePopstateGuard } from "@/lib/browserChrome";
import BottomChromeStrip from "@/components/BottomChromeStrip";
import TopChromeStrip from "@/components/TopChromeStrip";
import { PremiumLimitListener } from "@/components/premium/PremiumLimitListener";
import { CriteriaEvalProgress } from "@/components/CriteriaEvalProgress";
import NotFound from "@/pages/NotFound";

// ported from main.tsx — runs once in the browser, never on the server.
if (typeof window !== "undefined") {
  initClientBootstrap();
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ===== Pre-paint scripts ported verbatim from the old index.html <head> =====

const DOMAIN_REDIRECT_SCRIPT = `(function() {
  try {
    var h = window.location.hostname;
    var p = window.location.pathname;
    if (h.endsWith('.lovable.app') && h.indexOf('id-preview') === -1) {
      var isStagingRoot = h === 'parium-ab.lovable.app' && (p === '/' || p === '/index.html');
      if (!isStagingRoot) {
        var target = 'https://www.parium.se' + p + window.location.search + window.location.hash;
        window.location.replace(target);
      }
    }
  } catch (e) {}
})();
(function() {
  try {
    if (window.location.hostname.endsWith('.lovable.app')) {
      var d = 'no' + 'index', f = 'no' + 'follow';
      var m = document.createElement('meta');
      m.name = 'robots';
      m.content = d + ', ' + f;
      document.head.appendChild(m);
    }
  } catch (e) {}
})();
(function() {
  try {
    var h = window.location.hostname;
    var p = window.location.pathname;
    var isLovableHost = h === 'parium-ab.lovable.app' || (h.endsWith('.lovable.app') && h.indexOf('parium-ab') === 0);
    if (!isLovableHost) return;
    var pariumUrl = 'https://www.parium.se' + p + window.location.search + window.location.hash;
    var l = document.createElement('link');
    l.rel = 'canonical';
    l.href = pariumUrl.split('#')[0];
    document.head.appendChild(l);
    var isStagingRootForVerification = h === 'parium-ab.lovable.app' && (p === '/' || p === '/index.html');
    if (isStagingRootForVerification) return;
    window.location.replace(pariumUrl);
  } catch (e) {}
})();`;

const CHROME_COLOR_SCRIPT = `(function() {
  try {
    var path = window.location.pathname;
    var isLandingVideoRoute = path === '/' || path === '';
    var isAudienceLandingRoute = path === '/jobbsokare' || path === '/arbetsgivare';
    var isAuthRoute = path === '/auth';
    var chromeColor = isLandingVideoRoute
      ? '#2a2a2a'
      : (isAudienceLandingRoute ? '#001F3D' : (isAuthRoute ? '#062B5E' : '#00193D'));
    document.documentElement.classList.toggle('landing-video-chrome', isLandingVideoRoute);
    document.documentElement.classList.toggle('parium-app-chrome', !isLandingVideoRoute);
    document.documentElement.style.backgroundColor = chromeColor;
    // Taggen finns redan i serverns första HTML. Uppdatera bara dess värde
    // för direkta laddningar på andra routes; skapa den enbart som reserv.
    var tc = document.getElementById('parium-theme-color');
    if (!tc) {
      tc = document.createElement('meta');
      tc.id = 'parium-theme-color';
      tc.setAttribute('name', 'theme-color');
      document.head.appendChild(tc);
    }
    tc.setAttribute('content', chromeColor);
    var st = document.createElement('style');
    st.id = 'parium-initial-chrome-bg';
    st.textContent = 'html,body{background-color:' + chromeColor + ' !important;' +
      (isLandingVideoRoute ? 'background-image:none !important;' : '') + '}';
    document.head.appendChild(st);
    document.addEventListener('DOMContentLoaded', function() {
      document.body.classList.toggle('landing-video-chrome', isLandingVideoRoute);
      document.body.classList.toggle('parium-app-chrome', !isLandingVideoRoute);
      document.body.style.backgroundColor = chromeColor;
      if (!isLandingVideoRoute) {
        var initial = document.getElementById('parium-initial-chrome-bg');
        if (initial) initial.remove();
      }
    }, { once: true });
  } catch (e) {}
})();`;

const CACHE_KILLSWITCH_SCRIPT = `(function() {
  try {
    var host = window.location.hostname;
    var isPublicHost = host === 'parium.se' || host === 'www.parium.se' || host === 'parium-ab.lovable.app';
    if (!isPublicHost) return;
    var resetVersion = 'domain-hard-load-2026-04-26-v9-no-sw-no-cache';
    var resetParam = '_hard_reload';
    var attemptKey = 'parium_domain_hard_reload_attempt_' + resetVersion;
    var maxAttempts = 3;
    var url = new URL(window.location.href);
    var attempts = 0;
    try { attempts = parseInt(sessionStorage.getItem(attemptKey) || '0', 10) || 0; } catch (e) {}
    var cleanupTasks = [];
    var hadBlockingCache = false;
    try {
      if (window.caches && caches.keys) {
        cleanupTasks.push(caches.keys().then(function(keys) {
          if (keys && keys.length) hadBlockingCache = true;
          return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }).catch(function() {}));
      }
    } catch (e) {}
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        if (navigator.serviceWorker.controller) hadBlockingCache = true;
        cleanupTasks.push(navigator.serviceWorker.getRegistrations().then(function(regs) {
          if (regs && regs.length) hadBlockingCache = true;
          return Promise.all(regs.map(function(r) { try { return r.unregister(); } catch (e) { return false; } }));
        }).catch(function() {}));
      }
    } catch (e) {}
    if (!cleanupTasks.length) return;
    Promise.all(cleanupTasks).finally(function() {
      try {
        if (hadBlockingCache && attempts < maxAttempts) {
          sessionStorage.setItem(attemptKey, String(attempts + 1));
          var next = new URL(window.location.href);
          next.searchParams.set(resetParam, resetVersion + '-' + Date.now());
          window.location.replace(next.toString());
          return;
        }
        if (url.searchParams.has(resetParam)) {
          url.searchParams.delete(resetParam);
          window.history.replaceState({}, document.title, url.toString());
        }
      } catch (e) {
        try { window.location.reload(); } catch (e2) {}
      }
    });
  } catch (e) {}
})();`;

const ROUTE_PRELOADS_SCRIPT = `(function() {
  try {
    var path = window.location.pathname;
    var head = document.head;
    var add = function(attrs) {
      var l = document.createElement('link');
      for (var k in attrs) l.setAttribute(k, attrs[k]);
      head.appendChild(l);
    };
    if (path === '/' || path === '') {
      var _r = (window.innerWidth && window.innerHeight) ? (window.innerWidth / window.innerHeight) : 1.78;
      var _phone = (_r < 0.66) || (window.innerWidth <= 700 && _r < 0.72);
      var _tier = _phone ? 'portrait' : (_r < 1.25 ? 'tablet' : 'landscape');
      add({ rel: 'preload', as: 'image', href: _tier === 'portrait'
        ? '/__l5e/assets-v1/8fe1c07c-74c7-43c0-8b39-d0a69dd5345b/hero12-poster-portrait.jpg'
        : '/__l5e/assets-v1/9d937ee2-32b4-4b59-b8b6-d306ffb3b191/hero10-poster.jpg', type: 'image/jpeg', fetchpriority: 'high' });
      add({ rel: 'preload', as: 'image', href: '/assets/hero-woman-left-hand-verified.webp', type: 'image/webp', fetchpriority: 'high' });
      var conn = (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
      var saveData = !!(conn && conn.saveData);
      var slowNet = !!(conn && /(^|-)2g$/.test(conn.effectiveType || ''));
      if (!saveData && !slowNet) {
        var vw = window.innerWidth, vh = window.innerHeight;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var wantsHighRes = (vw * dpr) >= 1280;
        var lightUa = /Windows NT|Android/i.test(navigator.userAgent || '');
        var videoHref = _tier === 'portrait'
          ? '/__l5e/assets-v1/ef6b8689-0c38-42d7-a4e9-b46d09d87ff5/hero12-portrait.mp4'
          : _tier === 'tablet'
            ? '/__l5e/assets-v1/6919750b-0b51-4e02-9869-2e1d932251a4/hero10-desktop.mp4'
            : (wantsHighRes && !lightUa)
              ? '/__l5e/assets-v1/6919750b-0b51-4e02-9869-2e1d932251a4/hero10-desktop.mp4'
              : '/__l5e/assets-v1/4598f514-ba42-461f-b2b7-d0eaaef637a1/hero10-landscape-lite.mp4';
        var isSafari = /Safari/.test(navigator.userAgent || '') && !/Chrome|Chromium|Edg\\//.test(navigator.userAgent || '');
        if (isSafari) {
          add({ rel: 'preload', as: 'video', href: videoHref, type: 'video/mp4', fetchpriority: 'high' });
        }
      }
    } else if (path === '/jobbsokare' || path === '/arbetsgivare') {
      var ua = navigator.userAgent || '';
      if (path === '/jobbsokare') {
        add({ rel: 'preload', as: 'image', href: '/__l5e/assets-v1/53aa145c-808f-404d-aae7-633806c3aa3b/showcase-jobseeker-poster.jpg', type: 'image/jpeg', fetchpriority: 'high' });
        var c2 = (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
        var save2 = !!(c2 && c2.saveData);
        var slow2 = !!(c2 && /(^|-)2g$/.test(c2.effectiveType || ''));
        if (!save2 && !slow2) {
          var appleSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg\\//.test(ua);
          var probe = document.createElement('video');
          var hevcOk = appleSafari && probe.canPlayType && probe.canPlayType('video/mp4; codecs="hvc1"') === 'probably';
          var vw2 = window.innerWidth;
          var cssW = vw2 >= 1280 ? 285 : vw2 >= 1024 ? 260 : vw2 >= 768 ? 230 : vw2 >= 640 ? 215 : Math.min(190, vw2 - 48);
          var dpr2 = Math.min(window.devicePixelRatio || 1, 3);
          var target = cssW * dpr2;
          var isWin = /Windows NT/i.test(ua);
          var rung = target <= 456
            ? '/__l5e/assets-v1/9af23a07-0091-45b0-a439-cf420ec678f5/showcase-jobseeker-fit432.mp4'
            : target <= 672
              ? '/__l5e/assets-v1/9705fd9e-5a48-42d4-bfe6-57eb0196ef24/showcase-jobseeker-win-crisp.mp4'
              : '/__l5e/assets-v1/1cfd4117-8f8e-421f-82e5-ee879b5c7c7d/showcase-jobseeker-hi-crisp.mp4';
          var isAndroid = /Android/i.test(ua);
          var safe60Ok = isWin && probe.canPlayType && probe.canPlayType('video/mp4; codecs="avc1.42C020"') !== '';
          var showcaseHref = isWin
            ? (safe60Ok
              ? '/__l5e/assets-v1/eb09446f-4134-4310-a95e-73e5a4f82631/showcase-jobseeker-windows-safe60.mp4'
              : '/__l5e/assets-v1/43bca5d6-8e25-4573-95c4-539b38f07e12/showcase-jobseeker-windows-lite.mp4')
            : isAndroid
              ? '/__l5e/assets-v1/43bca5d6-8e25-4573-95c4-539b38f07e12/showcase-jobseeker-windows-lite.mp4'
              : rung;
          if (appleSafari) {
            add(hevcOk
              ? { rel: 'preload', as: 'video', href: '/__l5e/assets-v1/f7919f37-bcfe-44d3-9aa6-12eccc18f4eb/showcase-jobseeker.hevc.mp4', type: 'video/mp4; codecs="hvc1"', fetchpriority: 'high' }
              : { rel: 'preload', as: 'video', href: showcaseHref, type: 'video/mp4', fetchpriority: 'high' });
          }
        }
      }
      var deferSpline = /Windows NT/i.test(ua) || /Android/i.test(ua);
      if (!(path === '/jobbsokare' && deferSpline)) {
        add({ rel: 'preload', as: 'fetch', href: '/spline/parium-phone-scene.splinecode', crossorigin: 'anonymous', fetchpriority: 'low' });
      }
    } else if (path === '/om-oss') {
      add({ rel: 'preload', as: 'image', href: '/__l5e/assets-v1/95a6e9aa-759c-48fc-8a0f-ee4ae6239167/om-oss-banner.png', type: 'image/png', fetchpriority: 'high' });
    }
  } catch (e) {}
})();`;

const FONT_LOADER_SCRIPT = `(function() {
  try {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap';
    l.media = 'print';
    l.onload = function() { l.media = 'all'; l.onload = null; };
    document.head.appendChild(l);
  } catch (e) {}
})();`;

const ORG_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.parium.se/#organization",
      name: "Parium",
      legalName: "Parium AB",
      url: "https://www.parium.se",
      logo: "https://www.parium.se/parium-icon-v3-512.png",
      description:
        "Parium är en svensk jobbapp där du hittar lediga jobb som passar dig och där arbetsgivare hittar rätt kandidater. Skapa profil gratis, sök jobb och chatta direkt.",
    },
    {
      "@type": "WebSite",
      "@id": "https://www.parium.se/#website",
      url: "https://www.parium.se",
      name: "Parium",
      inLanguage: "sv-SE",
      publisher: { "@id": "https://www.parium.se/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://www.parium.se/jobb/{search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
});

// ===== Inline critical CSS ported verbatim from the old index.html <style> =====

const INLINE_CHROME_CSS = `
    html, body {
      background-color: #00193D;
    }
    #root { position: relative; z-index: 1; }
    :root { --pwa-top-offset: 0px; }
    @media (display-mode: standalone) {
      html, body {
        min-height: calc(100dvh + env(safe-area-inset-bottom, 0px));
      }
      :root { --pwa-top-offset: 0px; }
    }
    .animate-bounce { -webkit-backface-visibility: hidden; backface-visibility: hidden; }
    #portrait-warning {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: hsl(215 100% 12%);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }
    @media (orientation: landscape) and (max-height: 600px) and (pointer: coarse) {
      #portrait-warning {
        display: flex;
      }
      #root {
        visibility: hidden;
      }
    }
    #auth-splash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 50px;
      background: hsl(215, 100%, 12%);
      opacity: 1;
      transition: opacity 0.4s ease-out;
      transform: translateZ(0);
      will-change: opacity;
    }
    #auth-splash-logo,
    #auth-splash-tagline,
    #auth-splash-dots {
      opacity: 0;
      transition: opacity 0.4s ease-out;
    }
    #auth-splash.content-ready #auth-splash-logo,
    #auth-splash.content-ready #auth-splash-tagline,
    #auth-splash.content-ready #auth-splash-dots {
      opacity: 1;
    }
    @media (max-width: 640px) {
      #auth-splash { padding-top: calc(env(safe-area-inset-top, 0px) + 24px); }
    }
    #auth-splash.fade-out {
      opacity: 0;
      pointer-events: none;
    }
    #auth-splash-logo {
      height: 224px;
      width: auto;
      margin-bottom: 0;
      transform: translateZ(0);
    }
    @media (min-width: 1024px) {
      #auth-splash-logo { height: 256px; }
    }
    @media (max-width: 640px) {
      #auth-splash-logo { height: 200px; }
    }
    #auth-splash-tagline {
      color: white;
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-top: 8px;
      margin-bottom: 40px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    @media (min-width: 1024px) {
      #auth-splash-tagline { font-size: 1.5rem; }
    }
    @media (max-width: 640px) {
      #auth-splash-tagline { font-size: 1.5rem; margin-top: 4px; }
    }
    #auth-splash-dots {
      display: flex;
      align-items: center;
      gap: 10px;
      transition: opacity 0.4s ease-out;
    }
    #auth-splash-dots.fading {
      opacity: 0;
    }
    #auth-splash-dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.6);
      transform: translateZ(0);
      will-change: opacity, transform;
      animation: authSplashDotPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    #auth-splash-dots span:nth-child(1) { animation-delay: -1.7s; }
    #auth-splash-dots span:nth-child(2) { animation-delay: -1.3s; }
    #auth-splash-dots span:nth-child(3) { animation-delay: -0.9s; }
    @keyframes authSplashDotPulse {
      0%, 100% {
        opacity: 0.4;
        transform: translateZ(0) scale(1);
      }
      50% {
        opacity: 1;
        transform: translateZ(0) scale(1.15);
      }
    }
`;

const AUTH_SPLASH_SCRIPT = `(function() {
  try {
    var path = window.location.pathname;
    var skipSplash = false;
    try {
      skipSplash = sessionStorage.getItem('parium-skip-splash') === '1';
    } catch(e) {}
    if ((path === '/auth' || path === '/auth/') && !skipSplash) {
      var splash = document.getElementById('auth-splash');
      var logo = document.getElementById('auth-splash-logo');
      var tagline = document.getElementById('auth-splash-tagline');
      try {
        if (tagline && localStorage.getItem('parium-last-role') === 'employer') {
          tagline.textContent = 'Bygg ditt drömteam här';
        }
      } catch(e) {}
      if (splash && logo) {
        splash.style.display = 'flex';
        function showContent() {
          requestAnimationFrame(function() {
            splash.classList.add('content-ready');
          });
        }
        if (logo.complete && logo.naturalHeight !== 0) {
          showContent();
        } else {
          logo.onload = showContent;
          logo.onerror = showContent;
        }
        setTimeout(function() {
          var dots = document.getElementById('auth-splash-dots');
          if (dots) dots.classList.add('fading');
        }, 1500);
        setTimeout(function() {
          splash.classList.add('fade-out');
          setTimeout(function() {
            splash.style.display = 'none';
          }, 500);
        }, 2000);
      }
    }
  } catch(e) {}
})();`;

const PWA_OFFSET_SCRIPT = `(function() {
  try {
    var isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone && typeof navigator !== 'undefined' && navigator.standalone) {
      isStandalone = true;
    }
    if (isStandalone) {
      var base = 88;
      document.documentElement.style.setProperty('--pwa-top-offset', base + 'px');
      document.body.style.setProperty('--pwa-top-offset', base + 'px');
    }
  } catch (e) {}
})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      },
      { title: "Parium – Hitta jobb som passar dig & rekrytera rätt" },
      {
        name: "description",
        content:
          "Hitta lediga jobb som passar dig och chatta direkt med arbetsgivare – eller rekrytera rätt kandidater till ditt team. Gratis att komma igång.",
      },
      {
        name: "keywords",
        content: "rekrytering, lediga jobb, hitta jobb, jobbapp, jobbsajt, jobbsökare, söka jobb",
      },
      { name: "author", content: "Parium" },
      { httpEquiv: "Content-Language", content: "sv-SE" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "google-site-verification", content: "sT_ifEq3gWpYLlAA7K8O_I4xOyHau2g-FUa6j5C5y_E" },
      { name: "google-site-verification", content: "BmLp4Z31QrCWzPg_3lxUkSRFOCryhQCg2mqfCcRqvoE" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "sv_SE" },
      { property: "og:site_name", content: "Parium" },
      { property: "og:url", content: "https://www.parium.se/" },
      { property: "og:image", content: "https://www.parium.se/og-image.jpg" },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      {
        property: "og:image:alt",
        content:
          "Parium – jobbappen där du hittar lediga jobb och arbetsgivare hittar rätt kandidater",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://www.parium.se/og-image.jpg" },
      { name: "twitter:site", content: "@parium_se" },
      { property: "og:title", content: "Parium – Hitta jobb som passar dig & rekrytera rätt" },
      { name: "twitter:title", content: "Parium – Hitta jobb som passar dig & rekrytera rätt" },
      {
        property: "og:description",
        content:
          "Hitta lediga jobb som passar dig och chatta direkt med arbetsgivare – eller rekrytera rätt kandidater till ditt team. Gratis att komma igång.",
      },
      {
        name: "twitter:description",
        content:
          "Hitta lediga jobb som passar dig och chatta direkt med arbetsgivare – eller rekrytera rätt kandidater till ditt team. Gratis att komma igång.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://jrjaegapuujushsiofoi.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://jrjaegapuujushsiofoi.supabase.co" },
      { rel: "preconnect", href: "https://prod.spline.design", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://prod.spline.design" },
      { rel: "preload", as: "image", href: "/parium-auth-logo.png", fetchPriority: "high" },
      {
        rel: "preload",
        as: "image",
        href: "/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png",
        fetchPriority: "high",
      },
      { rel: "manifest", href: "/manifest.json?v=20260721-1" },
      { rel: "shortcut icon", href: "/parium-favicon-v3.ico?v=20260824-2", sizes: "any" },
      { rel: "icon", href: "/parium-favicon-v3.ico?v=20260824-2", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/parium-favicon-v3-32.png?v=20260824-2" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/parium-favicon-v3-48.png?v=20260824-2" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/parium-icon-v3-512.png?v=20260824-2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/parium-touch-icon-v3.png?v=20260824-2" },
      {
        rel: "apple-touch-icon-precomposed",
        sizes: "180x180",
        href: "/parium-touch-icon-v3.png?v=20260824-2",
      },
    ],
    scripts: [
      { children: DOMAIN_REDIRECT_SCRIPT },
      { children: CHROME_COLOR_SCRIPT },
      { children: CACHE_KILLSWITCH_SCRIPT },
      { children: ROUTE_PRELOADS_SCRIPT },
      { children: FONT_LOADER_SCRIPT },
      { type: "application/ld+json", children: ORG_JSONLD },
    ],
  }),
  beforeLoad: ({ location }) => {
    // Legacy-alias: /index renderade samma vy som /home i gamla SPA-routern,
    // men "index" är ett reserverat filnamn i den filbaserade routern.
    if (location.pathname === "/index") {
      throw redirect({ to: "/home", replace: true });
    }
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv-SE" suppressHydrationWarning>
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: INLINE_CHROME_CSS }} />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap"
          />
        </noscript>
      </head>
      <body suppressHydrationWarning>
        {/* AUTH SPLASH SCREEN - Only shown on /auth hard refresh */}
        <div id="auth-splash" aria-label="Laddar Parium">
          <img
            id="auth-splash-logo"
            src="/parium-auth-logo.png"
            alt="Parium"
            decoding="sync"
            fetchPriority="high"
          />
          <p id="auth-splash-tagline">Din karriärresa börjar här</p>
          <div id="auth-splash-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: AUTH_SPLASH_SCRIPT }} />

        {/* Portrait-only warning */}
        <div id="portrait-warning" role="alert" aria-live="polite">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "2rem", opacity: 0.9 }}
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <p
            role="heading"
            aria-level={2}
            style={{
              color: "white",
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "1rem",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Rotera din enhet
          </p>
          <p
            style={{
              color: "rgb(255,255,255)",
              fontSize: "1rem",
              fontFamily: "Inter, sans-serif",
              maxWidth: 320,
            }}
          >
            Parium fungerar bäst i porträttläge. Vrid tillbaka din telefon för att fortsätta
          </p>
        </div>

        {/* Hidden hero preloader for Safari/iOS */}
        <img
          src="/assets/hero-woman-left-hand-verified.webp"
          alt=""
          aria-hidden="true"
          decoding="sync"
          fetchPriority="high"
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
        />

        <div id="root">{children}</div>

        <script dangerouslySetInnerHTML={{ __html: PWA_OFFSET_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

const LIGHTWEIGHT_ROUTES = [
  "/",
  "/auth",
  "/jobbsokare",
  "/arbetsgivare",
  "/om-oss",
  "/integritetspolicy",
  "/dpa",
  "/unsubscribe",
];
const isPublicLightweightPath = (pathname: string) =>
  LIGHTWEIGHT_ROUTES.includes(pathname) ||
  pathname === "/jobb" ||
  pathname.startsWith("/jobb/") ||
  pathname === "/yrken" ||
  pathname.startsWith("/yrke/") ||
  pathname === "/kommuner" ||
  pathname.startsWith("/kommun/") ||
  pathname === "/annonser" ||
  pathname.startsWith("/annons/") ||
  pathname === "/guider" ||
  pathname.startsWith("/guider/");

const AppShell = () => {
  const location = useLocation();
  const isLightweightRoute = isPublicLightweightPath(location.pathname);
  const showHeader = false; // Header removed for cleaner UI

  // Skyddsnät: släpper alltid en kvarhängande pointer-events-spärr från Radix.
  useUiLockGuard();

  // Förladdda alla kritiska bilder globalt vid app-start.
  // Viktigt: på publika landningssidor vill vi INTE starta tunga app-preloads
  // som konkurrerar med hero/3D/videons first paint. (Beräknas EN gång, som förr.)
  const [preloadEnabled] = useState(() =>
    typeof window !== "undefined" ? !isPublicLightweightPath(window.location.pathname) : false,
  );
  useGlobalImagePreloader(preloadEnabled);

  useIsoLayoutEffect(() => {
    mountChromePopstateGuard();
    syncBrowserChrome(location.pathname);
  }, [location.pathname]);

  return (
    <>
      <TopChromeStrip />
      <BottomChromeStrip />
      <OfflineIndicator />
      {!isLightweightRoute && <SystemHealthPanel />}
      <UnsavedChangesProvider>
        {!isLightweightRoute && <PushNotificationProvider />}
        {!isLightweightRoute && <RealtimeKeepAlive />}
        {!isLightweightRoute && <OfflineQueueRunner />}
        <div className="min-h-screen safe-area-content overflow-x-hidden w-full max-w-full">
          {!isLightweightRoute && <CriticalAssetPreloads />}
          <div className="relative z-10">
            {showHeader && <Header />}
            <main className={showHeader ? "pt-16" : ""}>
              <AuthTokenBridge />
              <ScrollRestoration />
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
        <AuthSplashScreen />
      </UnsavedChangesProvider>
      <PremiumLimitListener />
    </>
  );
};

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <GlobalErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ConversationsProvider>
              <OnlineStatusProvider>
                <TooltipProvider delayDuration={0}>
                  <Toaster />
                  <AppFailureMonitor />
                  <CriteriaEvalProgress />
                  <AppShell />
                </TooltipProvider>
              </OnlineStatusProvider>
            </ConversationsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </GlobalErrorBoundary>
  );
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background text-foreground">
      <h1 className="text-xl font-semibold text-white">Något gick fel</h1>
      <p className="text-sm text-white max-w-xs">
        Sidan kunde inte visas just nu. Försök igen eller gå tillbaka till startsidan.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          className="px-6 py-3 rounded-full border border-white/25 bg-white/10 text-white font-semibold"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Försök igen
        </button>
        <a
          className="px-6 py-3 rounded-full border border-white/25 text-white font-semibold"
          href="/"
        >
          Till startsidan
        </a>
      </div>
    </div>
  );
}
