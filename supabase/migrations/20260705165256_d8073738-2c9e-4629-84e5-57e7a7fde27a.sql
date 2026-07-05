ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS part_time_days text[],
  ADD COLUMN IF NOT EXISTS duration_amount integer,
  ADD COLUMN IF NOT EXISTS duration_unit text;

ALTER TABLE public.job_templates
  ADD COLUMN IF NOT EXISTS part_time_days text[],
  ADD COLUMN IF NOT EXISTS duration_amount integer,
  ADD COLUMN IF NOT EXISTS duration_unit text;