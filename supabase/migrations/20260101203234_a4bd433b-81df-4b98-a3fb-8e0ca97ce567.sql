-- Create table for job-specific stage settings
CREATE TABLE public.job_stage_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  custom_label TEXT,
  color TEXT,
  icon_name TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, stage_key)
);

-- Enable RLS
ALTER TABLE public.job_stage_settings ENABLE ROW LEVEL SECURITY;

-- Employers can view stage settings for their own jobs
CREATE POLICY "Employers can view their job stage settings"
ON public.job_stage_settings
FOR SELECT
USING (employer_owns_job(job_id));

-- Employers can create stage settings for their own jobs
CREATE POLICY "Employers can create job stage settings"
ON public.job_stage_settings
FOR INSERT
WITH CHECK (employer_owns_job(job_id));

-- Employers can update stage settings for their own jobs
CREATE POLICY "Employers can update job stage settings"
ON public.job_stage_settings
FOR UPDATE
USING (employer_owns_job(job_id));

-- Employers can delete stage settings for their own jobs
CREATE POLICY "Employers can delete job stage settings"
ON public.job_stage_settings
FOR DELETE
USING (employer_owns_job(job_id));

-- Create trigger for updated_at
CREATE TRIGGER update_job_stage_settings_updated_at
  BEFORE UPDATE ON public.job_stage_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();