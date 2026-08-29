import { getAccuratePosition, wasLastPositionDenied, type GpsFix } from '@/lib/gpsUtils';
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


export interface ResolvePositionOptions {
  timeout?: number;
  maximumAge?: number;
}

/** Single-flight position resolution shared by every consumer in the app. */
export const resolvePosition = async (
  options: ResolvePositionOptions = {},
): Promise<GpsFix | null> => {
  if (!isPositionResolutionActive()) return null;
  if (Date.now() < deniedUntil) return null;

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const fix = await getAccuratePosition(options);
      if (!fix && wasLastPositionDenied()) {
        deniedUntil = Date.now() + DENY_BLOCK_MS;
      }
      return fix;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Called when the browser reports that location permission became granted. */
export const notePermissionGranted = () => {
  deniedUntil = 0;
};

/** True while the deny back-off window is active. */
export const isPositionBlocked = () => Date.now() < deniedUntil;

/** Test helper — resets all module state. */
export const resetGpsCoordinator = () => {
  inFlight = null;
  deniedUntil = 0;
  setPositionResolutionActive(true);
};
