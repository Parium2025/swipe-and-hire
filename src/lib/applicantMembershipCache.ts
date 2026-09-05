import { safeReadJsonCache, safeSetItem } from '@/lib/safeStorage';

const CACHE_PREFIX = 'parium_applicant_membership_v1_';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_IDS = 5_000;

interface ApplicantMembershipCache {
  applicantIds: string[];
  timestamp: number;
}

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

export function readApplicantMembershipCache(userId: string): Set<string> | null {
  const cached = safeReadJsonCache<ApplicantMembershipCache>(
    cacheKey(userId),
    (value): value is ApplicantMembershipCache => {
      const candidate = value as Partial<ApplicantMembershipCache>;
      return Array.isArray(candidate.applicantIds)
        && candidate.applicantIds.every((id) => typeof id === 'string')
        && typeof candidate.timestamp === 'number';
    },
  );

  if (!cached || Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) return null;
  return new Set(cached.applicantIds);
}

export function writeApplicantMembershipCache(userId: string, applicantIds: Iterable<string>): void {
  const uniqueIds = Array.from(new Set(applicantIds)).filter(Boolean).slice(0, MAX_CACHED_IDS);
  safeSetItem(cacheKey(userId), JSON.stringify({
    applicantIds: uniqueIds,
    timestamp: Date.now(),
  } satisfies ApplicantMembershipCache));
}

export function reconcileApplicantMembershipCache(
  userId: string,
  checkedApplicantIds: Iterable<string>,
  memberApplicantIds: Iterable<string>,
): void {
  const next = readApplicantMembershipCache(userId) ?? new Set<string>();
  for (const applicantId of checkedApplicantIds) next.delete(applicantId);
  for (const applicantId of memberApplicantIds) next.add(applicantId);
  writeApplicantMembershipCache(userId, next);
}

export function addApplicantMembershipCacheEntry(userId: string, applicantId: string): void {
  const next = readApplicantMembershipCache(userId) ?? new Set<string>();
  next.add(applicantId);
  writeApplicantMembershipCache(userId, next);
}

export function removeApplicantMembershipCacheEntry(userId: string, applicantId: string): void {
  const next = readApplicantMembershipCache(userId);
  if (!next) return;
  next.delete(applicantId);
  writeApplicantMembershipCache(userId, next);
}