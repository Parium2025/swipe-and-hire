import {
  checkGpsPermission,
  getAccuratePosition,
  wasLastPositionDenied,
  type GpsFix,
} from '@/lib/gpsUtils';
import { isPositionResolutionActive, setPositionResolutionActive } from '@/lib/gpsActivity';

export { isPositionResolutionActive, setPositionResolutionActive };

/**
 * Process-wide coordinator for GPS resolution.
 *
 * Two problems this solves:
 *  1. Several call sites (weather hook, login preload, background sync) used to
 *     hit the geolocation API in parallel, producing duplicated prompts,
 *     duplicated timeouts and duplicated "retrying with high accuracy" logs.
 *  2. After the user denies permission, every subsequent attempt fails
 *     instantly but still spams the console and the OS bridge.
 */

const DENY_BLOCK_MS = 10 * 60 * 1000;

let inFlight: Promise<GpsFix | null> | null = null;
let deniedUntil = 0;
let explicitlyGrantedForSession = false;
let consentEpoch = 0;
const precisePermissionListeners = new Set<(allowed: boolean) => void>();


export interface ResolvePositionOptions {
  timeout?: number;
  maximumAge?: number;
}

/**
 * Exact device location is an in-app, page-session opt-in. OS/browser
 * permission alone is never product consent after login/reload. Once the user
 * deliberately presses Activate we still fail closed if the OS later reports
 * denied; `prompt` remains usable for browsers with an incomplete Permissions
 * API because the successful in-app gesture is authoritative for this session.
 */
export const canUsePreciseLocation = async (): Promise<boolean> => {
  if (!explicitlyGrantedForSession) return false;
  const permission = await checkGpsPermission();
  if (permission === 'denied') {
    notePermissionRevoked();
    return false;
  }
  return explicitlyGrantedForSession;
};

/** Lets mounted location consumers react immediately to grant and revocation. */
export const subscribeToPreciseLocationPermission = (listener: (allowed: boolean) => void) => {
  precisePermissionListeners.add(listener);
  return () => {
    precisePermissionListeners.delete(listener);
  };
};

/** Single-flight position resolution shared by every consumer in the app. */
export const resolvePosition = async (
  options: ResolvePositionOptions = {},
): Promise<GpsFix | null> => {
  if (!isPositionResolutionActive()) return null;
  if (Date.now() < deniedUntil) return null;
  if (!(await canUsePreciseLocation())) return null;

  if (inFlight) return inFlight;
  const requestConsentEpoch = consentEpoch;

  const resolution: Promise<GpsFix | null> = (async () => {
    try {
      const fix = await getAccuratePosition(options);
      if (!fix && wasLastPositionDenied()) {
        notePermissionRevoked();
      }
      if (
        requestConsentEpoch !== consentEpoch ||
        !explicitlyGrantedForSession
      ) {
        return null;
      }
      return fix;
    } finally {
      if (inFlight === resolution) inFlight = null;
    }
  })();
  inFlight = resolution;

  return resolution;
};

/** Called when the browser reports that location permission became granted. */
export const notePermissionGranted = () => {
  deniedUntil = 0;
  const changed = !explicitlyGrantedForSession;
  explicitlyGrantedForSession = true;
  if (changed) {
    consentEpoch += 1;
    precisePermissionListeners.forEach((listener) => listener(true));
  }
};

/** Clears session consent immediately when the browser/OS revokes access. */
export const notePermissionRevoked = () => {
  deniedUntil = Date.now() + DENY_BLOCK_MS;
  const changed = explicitlyGrantedForSession;
  explicitlyGrantedForSession = false;
  if (changed) {
    consentEpoch += 1;
    precisePermissionListeners.forEach((listener) => listener(false));
  }
};

/** Ends precise consent at account/page-session boundaries without persisting it. */
export const resetPreciseLocationConsent = () => {
  deniedUntil = 0;
  explicitlyGrantedForSession = false;
  inFlight = null;
  consentEpoch += 1;
  // Account/page-session boundaries must always invalidate mounted consumers.
  // They may still hold GPS-derived cache even when consent and requests are
  // already idle (for example immediately after hydration from local storage).
  precisePermissionListeners.forEach((listener) => listener(false));
};

/** True while the deny back-off window is active. */
export const isPositionBlocked = () => Date.now() < deniedUntil;

/** Test helper — resets all module state. */
export const resetGpsCoordinator = () => {
  inFlight = null;
  deniedUntil = 0;
  explicitlyGrantedForSession = false;
  consentEpoch += 1;
  precisePermissionListeners.clear();
  setPositionResolutionActive(true);
};
