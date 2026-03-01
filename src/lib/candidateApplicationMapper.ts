import type { ApplicationData } from '@/hooks/useApplicationsData';

/**
 * Maps a raw job_applications row (with optional joined job title) into
 * the standard ApplicationData shape used across the candidates UI.
 *
 * Used by CandidatesTable's single-candidate fetch and batch prefetch
 * to eliminate duplicated transformation logic.
 */
export function mapRawToApplicationData(
  raw: {
    id: string;
    job_id: string;
    applicant_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    bio: string | null;
    cv_url: string | null;
    age: number | null;
    employment_status: string | null;
    work_schedule: string | null;
    availability: string | null;
    custom_answers: any;
    status: string | null;
    applied_at: string | null;
    updated_at: string;
    profile_image_snapshot_url?: string | null;
    video_snapshot_url?: string | null;
  },
  opts: {
    jobTitle?: string;
    fallbackProfileImageUrl?: string | null;
    fallbackVideoUrl?: string | null;
    fallbackIsProfileVideo?: boolean | null;
  } = {}
): ApplicationData {
  return {
    id: raw.id,
    job_id: raw.job_id,
    applicant_id: raw.applicant_id,
    first_name: raw.first_name,
    last_name: raw.last_name,
    email: raw.email,
    phone: raw.phone,
    location: raw.location,
    bio: raw.bio,
    cv_url: raw.cv_url,
    age: raw.age,
    employment_status: raw.employment_status,
    work_schedule: raw.work_schedule,
    availability: raw.availability,
    custom_answers: raw.custom_answers,
    status: raw.status,
    applied_at: raw.applied_at || '',
    updated_at: raw.updated_at,
    job_title: opts.jobTitle || 'Okänt jobb',
    profile_image_url: raw.profile_image_snapshot_url || opts.fallbackProfileImageUrl || null,
    video_url: raw.video_snapshot_url || opts.fallbackVideoUrl || null,
    is_profile_video: opts.fallbackIsProfileVideo ?? null,
  };
}
