CREATE OR REPLACE FUNCTION public.get_cron_job_health()
 RETURNS TABLE(jobname text, schedule text, active boolean, last_run_at timestamp with time zone, last_status text, last_success_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    r.last_run_at,
    r.last_status,
    r.last_success_at
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT
      max(d.start_time) AS last_run_at,
      (array_agg(d.status ORDER BY d.start_time DESC))[1]::text AS last_status,
      max(d.start_time) FILTER (WHERE d.status = 'succeeded') AS last_success_at
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
      AND d.start_time > now() - interval '30 days'
  ) r ON true
$function$;