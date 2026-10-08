CREATE POLICY "Users can view their skipped job postings"
ON public.job_postings FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.swipe_actions sa
  WHERE sa.job_id = job_postings.id
    AND sa.user_id = (SELECT auth.uid())
    AND sa.action = 'skipped'
));