/**
 * SHARED select + type for "Mina Ansökningar".
 *
 * All three data sources (initial query, background sync, realtime) MUST use
 * this constant to stay in sync. If a field is missing from one source but
 * present in another, that source will overwrite fresh data with `undefined`
 * and cause visible bugs (e.g. images disappearing).
 *
 * ➜ To add a field: add it BOTH to MY_APPLICATIONS_JOB_POSTINGS_SELECT and
 *   MyApplicationsJobPosting below. Nowhere else.
 */

export const MY_APPLICATIONS_JOB_POSTINGS_SELECT = `
  id,
  title,
  location,
  employment_type,
  workplace_city,
  workplace_county,
  workplace_name,
  is_active,
  created_at,
  expires_at,
  deleted_at,
  applications_count,
  views_count,
  job_image_url,
  job_image_desktop_url,
  image_focus_position,
  positions_count,
  company_logo_url,
  overlay_text_color
` as const;

export const MY_APPLICATIONS_SELECT = `
  id,
  job_id,
  status,
  applied_at,
  created_at,
  job_postings (${MY_APPLICATIONS_JOB_POSTINGS_SELECT})
` as const;

export interface MyApplicationsJobPosting {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  workplace_city: string | null;
  workplace_county: string | null;
  workplace_name: string | null;
  is_active: boolean | null;
  created_at: string;
  expires_at: string | null;
  deleted_at: string | null;
  applications_count: number | null;
  views_count: number | null;
  job_image_url: string | null;
  job_image_desktop_url: string | null;
  image_focus_position: string | null;
  positions_count: number | null;
  company_logo_url: string | null;
  overlay_text_color: string | null;
}

export interface MyApplication {
  id: string;
  job_id: string;
  status: string;
  applied_at: string;
  created_at: string;
  job_postings: MyApplicationsJobPosting | null;
}
