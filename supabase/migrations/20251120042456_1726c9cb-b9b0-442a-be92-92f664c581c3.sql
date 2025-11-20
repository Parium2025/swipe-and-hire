-- Create job_postings table
CREATE TABLE public.job_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  occupation TEXT,
  employment_type TEXT,
  work_schedule TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  is_active BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active job postings"
ON public.job_postings FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Employers can view their own job postings"
ON public.job_postings FOR SELECT
TO authenticated
USING (auth.uid() = employer_id);

CREATE POLICY "Employers can create job postings"
ON public.job_postings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their own job postings"
ON public.job_postings FOR UPDATE
TO authenticated
USING (auth.uid() = employer_id);

CREATE POLICY "Employers can delete their own job postings"
ON public.job_postings FOR DELETE
TO authenticated
USING (auth.uid() = employer_id);

-- Add missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_media_links JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_location TEXT;

-- Add missing columns to job_questions
ALTER TABLE public.job_questions ADD COLUMN IF NOT EXISTS placeholder_text TEXT;
ALTER TABLE public.job_questions ADD COLUMN IF NOT EXISTS description TEXT;

-- Create trigger for job_postings timestamp updates
CREATE TRIGGER update_job_postings_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for job_applications timestamp updates
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for company_reviews timestamp updates
CREATE TRIGGER update_company_reviews_updated_at
  BEFORE UPDATE ON public.company_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for job_templates timestamp updates
CREATE TRIGGER update_job_templates_updated_at
  BEFORE UPDATE ON public.job_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for job_question_templates timestamp updates
CREATE TRIGGER update_job_question_templates_updated_at
  BEFORE UPDATE ON public.job_question_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for job_questions timestamp updates
CREATE TRIGGER update_job_questions_updated_at
  BEFORE UPDATE ON public.job_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for user_data_consents timestamp updates
CREATE TRIGGER update_user_data_consents_updated_at
  BEFORE UPDATE ON public.user_data_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();