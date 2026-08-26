ALTER TABLE public.job_postings
  ADD CONSTRAINT job_postings_work_start_time_format
  CHECK (work_start_time IS NULL OR work_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;

ALTER TABLE public.job_postings
  ADD CONSTRAINT job_postings_work_end_time_format
  CHECK (work_end_time IS NULL OR work_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;

ALTER TABLE public.job_templates
  ADD CONSTRAINT job_templates_work_start_time_format
  CHECK (work_start_time IS NULL OR work_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;

ALTER TABLE public.job_templates
  ADD CONSTRAINT job_templates_work_end_time_format
  CHECK (work_end_time IS NULL OR work_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;