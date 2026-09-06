-- En enda genomsökning av körhistoriken (7 dagar) istället för två per jobb.
CREATE OR REPLACE FUNCTION public.get_cron_job_health()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_success_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH runs AS (
    SELECT
      d.jobid,
      max(d.start_time) AS last_run_at,
      max(d.start_time) FILTER (WHERE d.status = 'succeeded') AS last_success_at,
      (array_agg(d.status ORDER BY d.start_time DESC))[1]::text AS last_status
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '7 days'
    GROUP BY d.jobid
  )
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    r.last_run_at,
    r.last_status,
    r.last_success_at
  FROM cron.job j
  LEFT JOIN runs r ON r.jobid = j.jobid
$$;
