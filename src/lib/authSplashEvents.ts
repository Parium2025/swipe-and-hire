// Simple, dependency-free event bus for showing/hiding the auth transition splash.
// We keep this outside React so it can be triggered from any layer (pages, hooks).

export const AUTH_SPLASH_SHOW_EVENT = "parium:auth-splash:show";
export const AUTH_SPLASH_HIDE_EVENT = "parium:auth-splash:hide";

// Keep refresh-splash and in-app click-splash perfectly identical.
// This is the minimum time the shell stays visible once shown.
const AUTH_SPLASH_MIN_MS = 4000;

// Track if splash is currently shown to prevent double-triggers
let splashVisible = false;

let hideTimer: number | null = null;

function getStaticSplashEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("auth-splash");
}

function ensureRouteClass(on: boolean) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (on) html.classList.add("route-outsidan");
  else html.classList.remove("route-outsidan");

  if (document.body) {
    if (on) document.body.classList.add("route-outsidan");
    else document.body.classList.remove("route-outsidan");
  }
}

function getShownAt(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const v = (window as any).__pariumAuthSplashTs as number | undefined;
  return typeof v === "number" ? v : undefined;
}

function setShownAt(ts: number) {
  if (typeof window === "undefined") return;
  (window as any).__pariumAuthSplashTs = ts;
}

function showStaticSplashDom() {
  const el = getStaticSplashEl();
  if (el) el.classList.remove("hidden");
  ensureRouteClass(true);
}

function hideStaticSplashDom() {
  const el = getStaticSplashEl();
  if (el) el.classList.add("hidden");
  ensureRouteClass(false);
}

// If we refreshed on /auth, the pre-React script may already have shown the static splash.
// Sync our internal state so hideAuthSplash() behaves consistently.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const el = getStaticSplashEl();
  const isShownByHtml =
    (document.documentElement.classList.contains("route-outsidan") ||
      document.body?.classList.contains("route-outsidan")) &&
    el &&
    !el.classList.contains("hidden");

  if (isShownByHtml) {
    splashVisible = true;
    if (!getShownAt()) setShownAt(Date.now());
  }
}

export function showAuthSplash() {
  if (typeof window === "undefined") return;
  if (splashVisible) return; // Already showing
  splashVisible = true;

  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  setShownAt(Date.now());
  // Use the exact same DOM splash as refresh to ensure identical visuals.
  showStaticSplashDom();
  window.dispatchEvent(new Event(AUTH_SPLASH_SHOW_EVENT));
}

export function hideAuthSplash() {
  if (typeof window === "undefined") return;
  if (!splashVisible) return; // Not showing

  splashVisible = false;
  window.dispatchEvent(new Event(AUTH_SPLASH_HIDE_EVENT));

  const shownAt = getShownAt();
  const elapsed = typeof shownAt === "number" ? Date.now() - shownAt : AUTH_SPLASH_MIN_MS;
  const remaining = Math.max(0, AUTH_SPLASH_MIN_MS - elapsed);

  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  hideTimer = window.setTimeout(() => {
    hideStaticSplashDom();
    hideTimer = null;
  }, remaining);
}

export function isSplashVisible() {
  return splashVisible;
}
