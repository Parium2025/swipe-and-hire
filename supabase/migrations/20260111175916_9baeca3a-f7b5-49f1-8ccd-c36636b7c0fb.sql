-- Create persistent candidate ratings table
-- Ratings persist even when candidate is removed from my_candidates
CREATE TABLE public.candidate_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL,
  recruiter_id UUID NOT NULL,
  job_id UUID REFERENCES public.job_postings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint: one rating per recruiter per applicant
  UNIQUE(recruiter_id, applicant_id)
);

-- Enable RLS
ALTER TABLE public.candidate_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Same pattern as my_candidates for organization access
CREATE POLICY "Recruiters can view their own ratings"
  ON public.candidate_ratings FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Organization members can view colleague ratings"
  ON public.candidate_ratings FOR SELECT
  USING (same_organization(auth.uid(), recruiter_id));

CREATE POLICY "Recruiters can create ratings"
  ON public.candidate_ratings FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can update their own ratings"
  ON public.candidate_ratings FOR UPDATE
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can delete their own ratings"
  ON public.candidate_ratings FOR DELETE
  USING (auth.uid() = recruiter_id);

-- Create index for fast lookups
CREATE INDEX idx_candidate_ratings_applicant ON public.candidate_ratings(applicant_id);
CREATE INDEX idx_candidate_ratings_recruiter ON public.candidate_ratings(recruiter_id);

-- Trigger for updated_at
CREATE TRIGGER update_candidate_ratings_updated_at
  BEFORE UPDATE ON public.candidate_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();