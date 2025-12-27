-- ===========================================
-- AI Selection Criteria System
-- ===========================================

-- Table: job_criteria - Stores selection criteria for each job
CREATE TABLE public.job_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL,
  title TEXT NOT NULL, -- Display title for the recruiter (e.g., "Har körkort")
  prompt TEXT NOT NULL, -- What AI should check for (e.g., "Kontrollera om kandidaten har B-körkort")
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: candidate_evaluations - Tracks evaluation sessions
CREATE TABLE public.candidate_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  evaluated_by UUID, -- Who triggered the evaluation (null = automatic)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  evaluated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, applicant_id)
);

-- Table: criterion_results - Individual results per criterion
CREATE TABLE public.criterion_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.candidate_evaluations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.job_criteria(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('match', 'no_match', 'no_data')), -- ✅, ❌, ⚠️
  confidence NUMERIC(3,2), -- 0.00 to 1.00
  reasoning TEXT, -- AI explanation of why
  source TEXT, -- Where the info was found: 'cv', 'answer', 'profile', 'application'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, criterion_id)
);

-- Table: candidate_summaries - AI-generated summaries
CREATE TABLE public.candidate_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL, -- The AI-generated summary
  key_points JSONB, -- Array of key points with icons
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, applicant_id)
);

-- Enable RLS on all tables
ALTER TABLE public.job_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criterion_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_summaries ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS Policies for job_criteria
-- ===========================================

-- Employers can view criteria for their own jobs
CREATE POLICY "Employers can view criteria for their jobs"
ON public.job_criteria
FOR SELECT
USING (employer_owns_job(job_id));

-- Employers can create criteria for their own jobs
CREATE POLICY "Employers can create criteria for their jobs"
ON public.job_criteria
FOR INSERT
WITH CHECK (employer_owns_job(job_id) AND auth.uid() = employer_id);

-- Employers can update criteria for their own jobs
CREATE POLICY "Employers can update criteria for their jobs"
ON public.job_criteria
FOR UPDATE
USING (employer_owns_job(job_id));

-- Employers can delete criteria for their own jobs
CREATE POLICY "Employers can delete criteria for their jobs"
ON public.job_criteria
FOR DELETE
USING (employer_owns_job(job_id));

-- ===========================================
-- RLS Policies for candidate_evaluations
-- ===========================================

-- Employers can view evaluations for applications to their jobs
CREATE POLICY "Employers can view evaluations for their jobs"
ON public.candidate_evaluations
FOR SELECT
USING (can_view_job_application(job_id));

-- Employers can create evaluations for applications to their jobs
CREATE POLICY "Employers can create evaluations for their jobs"
ON public.candidate_evaluations
FOR INSERT
WITH CHECK (can_view_job_application(job_id));

-- Employers can update evaluations for their jobs
CREATE POLICY "Employers can update evaluations for their jobs"
ON public.candidate_evaluations
FOR UPDATE
USING (can_view_job_application(job_id));

-- ===========================================
-- RLS Policies for criterion_results
-- ===========================================

-- Employers can view results for evaluations they can access
CREATE POLICY "Employers can view criterion results"
ON public.criterion_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.candidate_evaluations ce
    WHERE ce.id = criterion_results.evaluation_id
    AND can_view_job_application(ce.job_id)
  )
);

-- Employers can insert results for evaluations they can access
CREATE POLICY "Employers can insert criterion results"
ON public.criterion_results
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidate_evaluations ce
    WHERE ce.id = criterion_results.evaluation_id
    AND can_view_job_application(ce.job_id)
  )
);

-- ===========================================
-- RLS Policies for candidate_summaries
-- ===========================================

-- Employers can view summaries for applications to their jobs
CREATE POLICY "Employers can view summaries for their jobs"
ON public.candidate_summaries
FOR SELECT
USING (can_view_job_application(job_id));

-- Employers can create summaries for applications to their jobs
CREATE POLICY "Employers can create summaries for their jobs"
ON public.candidate_summaries
FOR INSERT
WITH CHECK (can_view_job_application(job_id));

-- Employers can update summaries for their jobs
CREATE POLICY "Employers can update summaries for their jobs"
ON public.candidate_summaries
FOR UPDATE
USING (can_view_job_application(job_id));

-- ===========================================
-- Triggers for updated_at
-- ===========================================

CREATE TRIGGER update_job_criteria_updated_at
BEFORE UPDATE ON public.job_criteria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_evaluations_updated_at
BEFORE UPDATE ON public.candidate_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_summaries_updated_at
BEFORE UPDATE ON public.candidate_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- Indexes for performance
-- ===========================================

CREATE INDEX idx_job_criteria_job_id ON public.job_criteria(job_id);
CREATE INDEX idx_candidate_evaluations_job_applicant ON public.candidate_evaluations(job_id, applicant_id);
CREATE INDEX idx_criterion_results_evaluation_id ON public.criterion_results(evaluation_id);
CREATE INDEX idx_candidate_summaries_job_applicant ON public.candidate_summaries(job_id, applicant_id);