UPDATE public.job_postings
SET
  work_start_time = CASE
    WHEN work_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN work_start_time
    ELSE NULL
  END,
  work_end_time = CASE
    WHEN work_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN work_end_time
    ELSE NULL
  END
WHERE (work_start_time IS NOT NULL AND work_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
   OR (work_end_time IS NOT NULL AND work_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE public.job_postings VALIDATE CONSTRAINT job_postings_work_start_time_format;
ALTER TABLE public.job_postings VALIDATE CONSTRAINT job_postings_work_end_time_format;