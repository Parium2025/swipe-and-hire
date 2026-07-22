GRANT SELECT ON public.job_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_questions TO authenticated;
GRANT ALL ON public.job_questions TO service_role;

DROP POLICY IF EXISTS "View questions for active jobs or own jobs" ON public.job_questions;
DROP POLICY IF EXISTS "View questions for active jobs or organization jobs" ON public.job_questions;

CREATE POLICY "View questions for active jobs or organization jobs"
ON public.job_questions
FOR SELECT
USING (
  public.employer_owns_job_for_question(job_id)
  OR EXISTS (
    SELECT 1
    FROM public.job_postings jp
    WHERE jp.id = job_questions.job_id
      AND public.same_organization(auth.uid(), jp.employer_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.job_postings jp
    WHERE jp.id = job_questions.job_id
      AND jp.is_active = true
      AND jp.deleted_at IS NULL
  )
);