-- Fix: Allow anonymous users to view active job postings
DROP POLICY IF EXISTS "Anyone can view active job postings" ON public.job_postings;
CREATE POLICY "Anyone can view active job postings"
ON public.job_postings
FOR SELECT
TO public
USING (is_active = true AND deleted_at IS NULL);

-- Fix: Allow anonymous users to view job questions
DROP POLICY IF EXISTS "Anyone can view job questions" ON public.job_questions;
CREATE POLICY "Anyone can view job questions"
ON public.job_questions
FOR SELECT
TO public
USING (true);