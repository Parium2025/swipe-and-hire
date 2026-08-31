/**
 * Legacy compatibility shim.
 *
 * Older builds called a destructive one-time reset here. The versioned shell
 * worker now owns its own cache lifecycle, so automatic browser-wide cleanup
 * would destroy valid offline state. Keep the exports until all old imports
 * have disappeared, but never mutate registrations or Cache Storage here.
 */
const RESET_VERSION = 'sw-shell-safe-2026-08-30-v1';

export const getServiceWorkerResetVersion = (): string => RESET_VERSION;

export function forceServiceWorkerReset(): void {
  // Intentionally empty. /reset-cache.html remains the explicit escape hatch.
}
