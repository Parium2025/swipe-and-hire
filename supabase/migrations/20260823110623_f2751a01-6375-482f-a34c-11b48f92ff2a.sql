CREATE OR REPLACE FUNCTION public.count_job_applications_per_stage(p_job_id uuid)
RETURNS TABLE(status text, application_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ja.status, count(*) AS application_count
  FROM public.job_applications ja
  WHERE ja.job_id = p_job_id
    AND public.can_view_job_application(p_job_id)
  GROUP BY ja.status
$$;

GRANT EXECUTE ON FUNCTION public.count_job_applications_per_stage(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_job_applications_job_status ON public.job_applications (job_id, status);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_applied_at ON public.job_applications (job_id, applied_at DESC, id DESC);