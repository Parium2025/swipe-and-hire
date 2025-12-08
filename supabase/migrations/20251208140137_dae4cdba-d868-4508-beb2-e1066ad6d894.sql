-- Add missing RLS policies for job_questions table
-- Employers should be able to manage questions for their own job postings

-- Create a helper function to check if employer owns the job for a question
CREATE OR REPLACE FUNCTION public.employer_owns_job_for_question(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_postings
    WHERE id = p_job_id
    AND employer_id = auth.uid()
  )
$$;

-- Employers can create questions for their own job postings
CREATE POLICY "Employers can create questions for their jobs"
ON public.job_questions
FOR INSERT
TO authenticated
WITH CHECK (employer_owns_job_for_question(job_id));

-- Employers can update questions for their own job postings
CREATE POLICY "Employers can update questions for their jobs"
ON public.job_questions
FOR UPDATE
TO authenticated
USING (employer_owns_job_for_question(job_id));

-- Employers can delete questions for their own job postings
CREATE POLICY "Employers can delete questions for their jobs"
ON public.job_questions
FOR DELETE
TO authenticated
USING (employer_owns_job_for_question(job_id));