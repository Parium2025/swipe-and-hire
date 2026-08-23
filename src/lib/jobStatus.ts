/**
 * Livslängd för en publicerad/återpublicerad annons.
 * Enda sanningen i klienten – matchar SQL-defaulten i republish_job(_days).
 */
export const REPUBLISH_DAYS = 14;

export interface EmployerStatusJobLike {
  is_active: boolean | null;
  expires_at?: string | null;
  /** Null = annonsen har aldrig publicerats → kan aldrig vara "utgången". */
  published_at?: string | null;
}

export type EmployerJobStatus = 'active' | 'expired' | 'draft';

function hasValidExpiry(expiresAt?: string | null): expiresAt is string {
  if (!expiresAt) return false;
  return !Number.isNaN(new Date(expiresAt).getTime());
}

/** En annons som aldrig publicerats är alltid ett utkast, oavsett expires_at. */
function isNeverPublished(job: EmployerStatusJobLike): boolean {
  return 'published_at' in job && !job.published_at;
}

export function isEmployerJobExpired(job: EmployerStatusJobLike): boolean {
  if (isNeverPublished(job)) return false;
  if (!hasValidExpiry(job.expires_at)) return false;
  return new Date(job.expires_at) < new Date();
}

export function isEmployerJobDraft(job: EmployerStatusJobLike): boolean {
  if (job.is_active) return false;
  if (isNeverPublished(job)) return true;
  if (!hasValidExpiry(job.expires_at)) return true;
  return !isEmployerJobExpired(job);
}


export function isEmployerJobActive(job: EmployerStatusJobLike): boolean {
  return !isEmployerJobDraft(job) && !isEmployerJobExpired(job);
}

export function getEmployerJobStatus(job: EmployerStatusJobLike): EmployerJobStatus {
  if (isEmployerJobExpired(job)) return 'expired';
  if (isEmployerJobDraft(job)) return 'draft';
  return 'active';
}
