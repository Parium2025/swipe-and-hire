-- Create table for tracking recruiter's personal candidates with pipeline stages
CREATE TABLE public.my_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  application_id UUID NOT NULL,
  job_id UUID,
  stage TEXT NOT NULL DEFAULT 'to_contact',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent duplicate entries per recruiter/application
  UNIQUE(recruiter_id, application_id)
);

-- Enable Row Level Security
ALTER TABLE public.my_candidates ENABLE ROW LEVEL SECURITY;

-- Policy: Recruiters can only view their own candidates
CREATE POLICY "Recruiters can view their own candidates"
ON public.my_candidates
FOR SELECT
USING (auth.uid() = recruiter_id);

-- Policy: Recruiters can add candidates to their list
CREATE POLICY "Recruiters can add candidates"
ON public.my_candidates
FOR INSERT
WITH CHECK (auth.uid() = recruiter_id);

-- Policy: Recruiters can update their own candidates (move between stages, add notes)
CREATE POLICY "Recruiters can update their own candidates"
ON public.my_candidates
FOR UPDATE
USING (auth.uid() = recruiter_id);

-- Policy: Recruiters can remove candidates from their list
CREATE POLICY "Recruiters can delete their own candidates"
ON public.my_candidates
FOR DELETE
USING (auth.uid() = recruiter_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_my_candidates_updated_at
BEFORE UPDATE ON public.my_candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups by recruiter
CREATE INDEX idx_my_candidates_recruiter_id ON public.my_candidates(recruiter_id);
CREATE INDEX idx_my_candidates_stage ON public.my_candidates(recruiter_id, stage);