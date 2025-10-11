-- Create job question templates table for reusable questions
CREATE TABLE IF NOT EXISTS public.job_question_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text', 'yes_no', 'multiple_choice', 'number')),
  options JSONB,
  placeholder_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usage_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.job_question_templates ENABLE ROW LEVEL SECURITY;

-- Employers can view their own question templates
CREATE POLICY "Employers can view their own templates"
  ON public.job_question_templates
  FOR SELECT
  USING (employer_id = auth.uid());

-- Employers can create their own question templates
CREATE POLICY "Employers can create their own templates"
  ON public.job_question_templates
  FOR INSERT
  WITH CHECK (employer_id = auth.uid());

-- Employers can update their own question templates
CREATE POLICY "Employers can update their own templates"
  ON public.job_question_templates
  FOR UPDATE
  USING (employer_id = auth.uid());

-- Employers can delete their own question templates
CREATE POLICY "Employers can delete their own templates"
  ON public.job_question_templates
  FOR DELETE
  USING (employer_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_question_templates_employer ON public.job_question_templates(employer_id);
CREATE INDEX idx_question_templates_usage ON public.job_question_templates(employer_id, usage_count DESC);