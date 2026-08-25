ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_title_length_check;

ALTER TABLE public.job_templates
  DROP CONSTRAINT IF EXISTS job_templates_title_length_check,
  DROP CONSTRAINT IF EXISTS job_templates_name_length_check;