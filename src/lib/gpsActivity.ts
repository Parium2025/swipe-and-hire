/**
 * Page-awareness flag for GPS resolution.
 *
 * Kept in its own module so consumers (useWeather) can register their
 * visibility without importing the whole coordinator — the coordinator
 * re-exports the setter/getter for callers that already depend on it.
 *
 * Defaults to true so login prewarm and the employer flow are unaffected.
 */
let positionResolutionActive = true;

/** Registers whether position resolution is currently allowed. */
export const setPositionResolutionActive = (active: boolean) => {
  positionResolutionActive = active;
};

/** True when position resolution is currently allowed. */
export const isPositionResolutionActive = () => positionResolutionActive;
