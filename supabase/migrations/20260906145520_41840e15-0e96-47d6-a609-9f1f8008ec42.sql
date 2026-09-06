-- 1) Snabbare hälsokoll: DISTINCT ON per jobb istället för aggregering över
--    hela historiken, och 7 dagars fönster (samma som get_cron_recent_failures
--    maximalt tittar på). Ger samma kolumner och semantik som tidigare.
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
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    r.last_run_at,
    r.last_status,
    s.last_success_at
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time AS last_run_at, d.status::text AS last_status
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
      AND d.start_time > now() - interval '7 days'
    ORDER BY d.start_time DESC
    LIMIT 1
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT d.start_time AS last_success_at
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
      AND d.status = 'succeeded'
      AND d.start_time > now() - interval '7 days'
    ORDER BY d.start_time DESC
    LIMIT 1
  ) s ON true
$$;

-- 2) Körhistoriken städas oftare och behålls i 7 dagar (räcker för både
--    hälsokollen och felrapporten). Undviker att tabellen växer till
--    hundratals megabyte och gör nattkörningen billigare.
SELECT cron.unschedule('prune-cron-run-details-nightly');

SELECT cron.schedule(
  'prune-cron-run-details-hourly',
  '55 * * * *',
  $cron$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days'$cron$
);
