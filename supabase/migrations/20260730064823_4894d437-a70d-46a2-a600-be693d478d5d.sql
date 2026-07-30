DROP POLICY IF EXISTS "Users can view their saved job postings" ON public.job_postings;
CREATE POLICY "Users can view their saved job postings"
ON public.job_postings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.saved_jobs sj WHERE sj.job_id = job_postings.id AND sj.user_id = auth.uid()));

DROP POLICY IF EXISTS "Applicants can view applied job postings" ON public.job_postings;
CREATE POLICY "Applicants can view applied job postings"
ON public.job_postings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.job_applications ja WHERE ja.job_id = job_postings.id AND ja.applicant_id = auth.uid()));

DROP POLICY IF EXISTS "Employers can view their own jobs" ON public.job_postings;

DROP POLICY IF EXISTS "Anyone can view active job postings" ON public.job_postings;
CREATE POLICY "Anyone can view active job postings"
ON public.job_postings FOR SELECT
USING (is_active = true AND deleted_at IS NULL);