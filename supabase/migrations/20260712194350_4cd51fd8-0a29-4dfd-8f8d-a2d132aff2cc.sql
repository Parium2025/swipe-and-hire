-- Restrict job_questions SELECT: only for active, non-deleted jobs, or the owning employer
DROP POLICY IF EXISTS "Anyone can view job questions" ON public.job_questions;

CREATE POLICY "View questions for active jobs or own jobs"
ON public.job_questions
FOR SELECT
USING (
  -- Owning employer/org can always see (drafts, expired, etc.)
  public.employer_owns_job_for_question(job_id)
  OR
  -- Everyone else only sees questions for active, non-deleted jobs
  EXISTS (
    SELECT 1 FROM public.job_postings jp
    WHERE jp.id = job_questions.job_id
      AND jp.is_active = true
      AND jp.deleted_at IS NULL
  )
);