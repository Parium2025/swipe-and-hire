-- Create table for custom application questions
CREATE TABLE public.job_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('yes_no', 'text', 'video', 'multiple_choice')),
  options JSONB, -- For multiple choice options (like B-kort, krankort, etc.)
  is_required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_questions ENABLE ROW LEVEL SECURITY;

-- Create policies for job questions
CREATE POLICY "Anyone can view questions for active jobs" 
ON public.job_questions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.job_postings 
    WHERE id = job_questions.job_id 
    AND is_active = true
  )
);

CREATE POLICY "Employers can view questions for their jobs" 
ON public.job_questions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_postings 
    WHERE id = job_questions.job_id 
    AND employer_id = auth.uid()
  )
);

CREATE POLICY "Employers can manage questions for their jobs" 
ON public.job_questions 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_postings 
    WHERE id = job_questions.job_id 
    AND employer_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_job_questions_job_id ON public.job_questions(job_id);
CREATE INDEX idx_job_questions_order ON public.job_questions(job_id, order_index);