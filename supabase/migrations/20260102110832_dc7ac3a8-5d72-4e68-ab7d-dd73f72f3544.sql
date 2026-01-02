-- Skapa tabell för proaktiva CV-analyser (oberoende av jobb)
CREATE TABLE public.profile_cv_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  cv_url TEXT NOT NULL,
  is_valid_cv BOOLEAN NOT NULL DEFAULT true,
  document_type TEXT,
  summary_text TEXT,
  key_points JSONB,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_cv_summaries ENABLE ROW LEVEL SECURITY;

-- Jobbsökare kan se sin egen summary
CREATE POLICY "Users can view their own cv summary"
ON public.profile_cv_summaries
FOR SELECT
USING (auth.uid() = user_id);

-- Jobbsökare kan uppdatera sin egen summary (system gör det via service role)
CREATE POLICY "Service role can manage all summaries"
ON public.profile_cv_summaries
FOR ALL
USING (true)
WITH CHECK (true);

-- Arbetsgivare kan se CV-sammanfattning för kandidater som sökt deras jobb
CREATE POLICY "Employers can view applicant cv summaries"
ON public.profile_cv_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = profile_cv_summaries.user_id
    AND (jp.employer_id = auth.uid() OR can_view_job_application(ja.job_id))
  )
);

-- Index för snabb sökning
CREATE INDEX idx_profile_cv_summaries_user_id ON public.profile_cv_summaries(user_id);
CREATE INDEX idx_profile_cv_summaries_cv_url ON public.profile_cv_summaries(cv_url);

-- Trigger för updated_at
CREATE TRIGGER update_profile_cv_summaries_updated_at
BEFORE UPDATE ON public.profile_cv_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();