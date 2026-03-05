import type { JobApplication } from '@/hooks/useJobDetailsData';
import type { ApplicationData } from '@/hooks/useApplicationsData';

/**
 * Maps a JobApplication (from useJobDetailsData) to ApplicationData (shared dialog format).
 * Single source of truth — prevents drift between swipe viewer and profile dialog.
 */
export function mapToApplicationData(
  app: JobApplication,
  jobId: string,
  jobTitle: string,
): ApplicationData {
  return {
    id: app.id,
    job_id: jobId,
    applicant_id: app.applicant_id,
    first_name: app.first_name,
    last_name: app.last_name,
    email: app.email,
    phone: app.phone,
    location: app.location,
    bio: app.bio,
    cv_url: app.cv_url,
    age: app.age,
    employment_status: app.employment_status,
    work_schedule: null,
    availability: app.availability,
    custom_answers: app.custom_answers,
    status: app.status,
    applied_at: app.applied_at,
    updated_at: app.applied_at,
    job_title: jobTitle,
    profile_image_url: app.profile_image_url,
    video_url: app.video_url,
    is_profile_video: app.is_profile_video,
    viewed_at: app.viewed_at,
    last_active_at: app.last_active_at,
    city: app.city,
    rating: app.rating,
  } as ApplicationData;
}
