-- Create job_applications table
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  cover_letter TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own applications"
ON public.job_applications FOR SELECT
TO authenticated
USING (auth.uid() = applicant_id);

CREATE POLICY "Users can create applications"
ON public.job_applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Users can update their own applications"
ON public.job_applications FOR UPDATE
TO authenticated
USING (auth.uid() = applicant_id);

-- Create company_reviews table
CREATE TABLE public.company_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
ON public.company_reviews FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create reviews"
ON public.company_reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.company_reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.company_reviews FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create job_templates table
CREATE TABLE public.job_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  occupation TEXT,
  employment_type TEXT,
  work_schedule TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view their own templates"
ON public.job_templates FOR SELECT
TO authenticated
USING (auth.uid() = employer_id);

CREATE POLICY "Employers can create templates"
ON public.job_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their own templates"
ON public.job_templates FOR UPDATE
TO authenticated
USING (auth.uid() = employer_id);

CREATE POLICY "Employers can delete their own templates"
ON public.job_templates FOR DELETE
TO authenticated
USING (auth.uid() = employer_id);

-- Create job_question_templates table
CREATE TABLE public.job_question_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options TEXT[],
  placeholder_text TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_question_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view their own question templates"
ON public.job_question_templates FOR SELECT
TO authenticated
USING (auth.uid() = employer_id);

CREATE POLICY "Employers can create question templates"
ON public.job_question_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = employer_id);

CREATE POLICY "Employers can update their own question templates"
ON public.job_question_templates FOR UPDATE
TO authenticated
USING (auth.uid() = employer_id);

CREATE POLICY "Employers can delete their own question templates"
ON public.job_question_templates FOR DELETE
TO authenticated
USING (auth.uid() = employer_id);

-- Create job_questions table
CREATE TABLE public.job_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options TEXT[],
  is_required BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  min_value INTEGER,
  max_value INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view job questions"
ON public.job_questions FOR SELECT
TO authenticated
USING (true);

-- Create user_data_consents table
CREATE TABLE public.user_data_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_data_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent"
ON public.user_data_consents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent"
ON public.user_data_consents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consent"
ON public.user_data_consents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);