-- Add questions field to job_templates table to store application questions
ALTER TABLE public.job_templates
ADD COLUMN questions jsonb DEFAULT '[]'::jsonb;