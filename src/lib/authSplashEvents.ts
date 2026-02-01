// Simple, dependency-free event bus for showing/hiding the auth transition splash.
// We keep this outside React so it can be triggered from any layer (pages, hooks).

export const AUTH_SPLASH_SHOW_EVENT = "parium:auth-splash:show";
export const AUTH_SPLASH_HIDE_EVENT = "parium:auth-splash:hide";

export function showAuthSplash() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SPLASH_SHOW_EVENT));
}

export function hideAuthSplash() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SPLASH_HIDE_EVENT));
}
