export interface EmployerStatusJobLike {
  is_active: boolean | null;
  expires_at?: string | null;
}

export type EmployerJobStatus = 'active' | 'expired' | 'draft';

function hasValidExpiry(expiresAt?: string | null): expiresAt is string {
  if (!expiresAt) return false;
  return !Number.isNaN(new Date(expiresAt).getTime());
}

export function isEmployerJobExpired(job: EmployerStatusJobLike): boolean {
  if (!hasValidExpiry(job.expires_at)) return false;
  return new Date(job.expires_at) < new Date();
}

export function isEmployerJobDraft(job: EmployerStatusJobLike): boolean {
  if (job.is_active) return false;
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
