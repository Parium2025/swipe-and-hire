// Delad typ för Swipe Mode — lyft från SwipeCard.tsx (som nu är borttagen)
// så att JobSlide, SwipeFullscreen, SwipeJobDetail och SwipeApplySheet kan
// importera utan att dra in oanvänd renderkod.
export interface SwipeJob {
  id: string;
  title: string;
  company_name: string;
  updated_at?: string | null;
  location: string | null;
  employment_type?: string | null;
  duration_amount?: number | null;
  duration_unit?: string | null;
  part_time_days?: string[] | null;
  part_time_shifts?: string[] | null;
  job_image_url?: string | null;
  image_focus_position?: string | null;
  views_count: number;
  applications_count: number;
  created_at: string;
  expires_at?: string | null;
  employer_id?: string | null;
  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string | null;
  occupation?: string | null;
  work_schedule?: string | null;
  remote_work_possible?: string | null;
  positions_count?: number | null;
  workplace_name?: string | null;
  work_location_type?: string | null;
  salary_transparency?: string | null;
  benefits?: string[] | null;
  company_logo_url?: string | null;
  overlay_text_color?: string | null;
}
