/**
 * @deprecated Använd `useImagePrewarm` direkt. Denna är kvar som tunn wrapper
 * för bakåtkompatibilitet med befintliga call-sites (SavedJobs, Dashboard,
 * EmployerDashboard). API:t är 1:1 — beteende oförändrat.
 */
export { useImagePrewarm as useBlobCachePrewarm } from './useImagePrewarm';
export type { PrewarmEntry } from './useImagePrewarm';
