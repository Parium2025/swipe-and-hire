CREATE OR REPLACE FUNCTION public.compute_job_fingerprint(j public.job_postings)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(
    public.normalize_job_text(j.title) || '|' ||
    public.normalize_job_text(j.description) || '|' ||
    public.normalize_job_text(j.requirements) || '|' ||
    public.normalize_job_text(j.occupation) || '|' ||
    public.normalize_job_text(j.pitch) || '|' ||
    public.normalize_job_text(j.workplace_name) || '|' ||
    public.normalize_job_text(j.workplace_address) || '|' ||
    public.normalize_job_text(j.workplace_postal_code) || '|' ||
    public.normalize_job_text(j.workplace_city) || '|' ||
    public.normalize_job_text(j.workplace_municipality) || '|' ||
    public.normalize_job_text(j.location) || '|' ||
    coalesce(j.employment_type, '') || '|' ||
    coalesce(j.work_schedule, '') || '|' ||
    coalesce(j.work_start_time, '') || '|' ||
    coalesce(j.work_end_time, '') || '|' ||
    coalesce(j.salary_min::text, '') || '|' ||
    coalesce(j.salary_max::text, '') || '|' ||
    coalesce(j.salary_type, '') || '|' ||
    coalesce(j.salary_transparency, '') || '|' ||
    coalesce(j.positions_count::text, '') || '|' ||
    coalesce(j.work_location_type, '') || '|' ||
    coalesce(j.remote_work_possible, '') || '|' ||
    coalesce(j.contact_email, '') || '|' ||
    coalesce(j.start_date::text, '') || '|' ||
    coalesce(j.duration_amount::text, '') || '|' ||
    coalesce(j.duration_unit, '') || '|' ||
    coalesce(array_to_string(j.benefits, ','), '') || '|' ||
    coalesce(array_to_string(j.part_time_days, ','), '') || '|' ||
    coalesce(array_to_string(j.part_time_shifts, ','), '')
  );
$$;

UPDATE public.job_postings
SET content_fingerprint = public.compute_job_fingerprint(job_postings.*)
WHERE deleted_at IS NULL;