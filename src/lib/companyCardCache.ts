import { safeReadJsonCache } from '@/lib/safeStorage';
export interface CompanyCardData {
  id: string; name: string; logo?: string; jobCount: number;
  avgRating?: number; reviewCount: number; selectedNames: string[];
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isCount = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function readCompanyOwnerCache(key: string | null): Record<string, string> {
  if (!key) return {};
  return safeReadJsonCache<Record<string, string>>(key, (v): v is Record<string, string> =>
    isRecord(v) && Object.values(v).every((id) => typeof id === 'string' && id.trim().length > 0)) ?? {};
}
export function readCompanyCardCache(key: string | null): Record<string, CompanyCardData> {
  if (!key) return {};
  return safeReadJsonCache<Record<string, CompanyCardData>>(key, (v): v is Record<string, CompanyCardData> =>
    isRecord(v) && Object.values(v).every((c) => isRecord(c)
      && typeof c.id === 'string' && c.id.length > 0 && typeof c.name === 'string' && c.name.length > 0
      && (c.logo === undefined || typeof c.logo === 'string') && isCount(c.jobCount) && isCount(c.reviewCount)
      && (c.avgRating === undefined || (typeof c.avgRating === 'number' && Number.isFinite(c.avgRating) && c.avgRating >= 1 && c.avgRating <= 5))
      && (c.reviewCount === 0 || typeof c.avgRating === 'number')
      && Array.isArray(c.selectedNames) && c.selectedNames.every((n) => typeof n === 'string'))) ?? {};
}
export const companyCardsReady = (jobsLoading: boolean, ownersReady: boolean, namesReady: boolean, reviewsReady: boolean) =>
  !jobsLoading && ownersReady && namesReady && reviewsReady;
