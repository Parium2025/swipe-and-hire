// Delad typ för Swipe Mode — lyft från SwipeCard.tsx (som nu är borttagen)
// så att JobSlide, SwipeFullscreen, SwipeJobDetail och SwipeApplySheet kan
// importera utan att dra in oanvänd renderkod.
export interface SwipeJob {
  id: string;
  title: string;
  company_name: string;
  updated_at?: string;
  location: string;
  employment_type?: string;
  job_image_url?: string;
  image_focus_position?: string;
  views_count: number;
  applications_count: number;
  created_at: string;
  expires_at?: string;
  employer_id?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  occupation?: string;
  work_schedule?: string;
  remote_work_possible?: string;
  positions_count?: number;
  workplace_name?: string;
  work_location_type?: string;
  salary_transparency?: string;
  benefits?: string[] | null;
  company_logo_url?: string;
  overlay_text_color?: string | null;
}
