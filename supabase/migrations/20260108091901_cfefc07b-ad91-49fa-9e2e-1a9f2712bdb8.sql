-- Create table to store employer's last seen counts per job
CREATE TABLE public.employer_job_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  last_seen_applications_count INTEGER NOT NULL DEFAULT 0,
  last_seen_views_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employer_id, job_id)
);

-- Enable RLS
ALTER TABLE public.employer_job_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Employers can view their own snapshots"
  ON public.employer_job_snapshots
  FOR SELECT
  USING (auth.uid() = employer_id);

CREATE POLICY "Employers can create their own snapshots"
  ON public.employer_job_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their own snapshots"
  ON public.employer_job_snapshots
  FOR UPDATE
  USING (auth.uid() = employer_id);

CREATE POLICY "Employers can delete their own snapshots"
  ON public.employer_job_snapshots
  FOR DELETE
  USING (auth.uid() = employer_id);

-- Add index for faster lookups
CREATE INDEX idx_employer_job_snapshots_employer ON public.employer_job_snapshots(employer_id);
CREATE INDEX idx_employer_job_snapshots_job ON public.employer_job_snapshots(job_id);

-- Trigger for updated_at
CREATE TRIGGER update_employer_job_snapshots_updated_at
  BEFORE UPDATE ON public.employer_job_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();