ALTER TABLE public.job_templates
ADD COLUMN IF NOT EXISTS work_start_time text,
ADD COLUMN IF NOT EXISTS work_end_time text;