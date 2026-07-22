export interface JobDetailsSkeletonHint {
  title?: string | null;
  location?: string | null;
  expiresAt?: string | null;
  viewsCount?: number | null;
  applicationsCount?: number | null;
  recruiterName?: string | null;
  isActive?: boolean | null;
}

interface HintSourceJob {
  id: string;
  title?: string | null;
  location?: string | null;
  expires_at?: string | null;
  views_count?: number | null;
  applications_count?: number | null;
  is_active?: boolean | null;
  employer_profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

const storageKey = (jobId: string) => `parium-job-details-skeleton:${jobId}`;

export const buildJobDetailsSkeletonHint = (job: HintSourceJob): JobDetailsSkeletonHint => {
  const firstName = job.employer_profile?.first_name?.trim();
  const lastName = job.employer_profile?.last_name?.trim();
  const recruiterName = [firstName, lastName].filter(Boolean).join(' ') || null;

  return {
    title: job.title ?? null,
    location: job.location ?? null,
    expiresAt: job.expires_at ?? null,
    viewsCount: job.views_count ?? 0,
    applicationsCount: job.applications_count ?? 0,
    recruiterName,
    isActive: job.is_active ?? null,
  };
};

export const storeJobDetailsSkeletonHint = (job: HintSourceJob) => {
  try {
    sessionStorage.setItem(storageKey(job.id), JSON.stringify(buildJobDetailsSkeletonHint(job)));
  } catch {
    // Non-critical polish hint only.
  }
};

export const readJobDetailsSkeletonHint = (jobId?: string): JobDetailsSkeletonHint | undefined => {
  if (!jobId) return undefined;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId));
    if (!raw) return undefined;
    return JSON.parse(raw) as JobDetailsSkeletonHint;
  } catch {
    return undefined;
  }
};