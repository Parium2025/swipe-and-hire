
-- 1. Add raw extracted text column to profile_cv_summaries
ALTER TABLE public.profile_cv_summaries 
ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- 2. Add raw extracted text column to candidate_summaries
ALTER TABLE public.candidate_summaries 
ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- 3. Create criterion_feedback table for recruiter corrections
CREATE TABLE public.criterion_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  criterion_id UUID NOT NULL REFERENCES public.job_criteria(id) ON DELETE CASCADE,
  evaluation_id UUID NOT NULL REFERENCES public.candidate_evaluations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  ai_result TEXT NOT NULL, -- what AI said: 'match' or 'no_match'
  corrected_result TEXT NOT NULL, -- what recruiter corrected to: 'match' or 'no_match'
  recruiter_note TEXT, -- optional explanation
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.criterion_feedback ENABLE ROW LEVEL SECURITY;

-- Recruiters can only manage their own feedback
CREATE POLICY "Recruiters can view own feedback"
ON public.criterion_feedback FOR SELECT
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can insert own feedback"
ON public.criterion_feedback FOR INSERT
WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can update own feedback"
ON public.criterion_feedback FOR UPDATE
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can delete own feedback"
ON public.criterion_feedback FOR DELETE
USING (auth.uid() = recruiter_id);

-- Index for fast lookups when building few-shot examples
CREATE INDEX idx_criterion_feedback_job_criterion 
ON public.criterion_feedback(job_id, criterion_id);

CREATE INDEX idx_criterion_feedback_recruiter 
ON public.criterion_feedback(recruiter_id);
