
-- Add criterion_results to realtime publication for live updates on candidate cards
ALTER PUBLICATION supabase_realtime ADD TABLE public.criterion_results;

-- Add UPDATE policy for criterion_results (needed for upsert via frontend if ever used)
CREATE POLICY "Employers can update criterion results"
ON public.criterion_results
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM candidate_evaluations ce
    WHERE ce.id = criterion_results.evaluation_id
    AND can_view_job_application(ce.job_id)
  )
);
