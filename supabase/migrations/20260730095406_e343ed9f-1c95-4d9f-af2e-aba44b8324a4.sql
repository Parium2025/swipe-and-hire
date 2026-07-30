CREATE OR REPLACE FUNCTION public.get_cron_recent_failures(_hours integer DEFAULT 24)
RETURNS TABLE(jobname text, jobid bigint, runid bigint, status text, return_message text, start_time timestamp with time zone, end_time timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
  SELECT j.jobname::text, d.jobid, d.runid, d.status::text, left(coalesce(d.return_message,''), 500),
         d.start_time, d.end_time
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.start_time > now() - make_interval(hours => greatest(1, least(_hours, 168)))
    AND d.status NOT IN ('succeeded', 'running', 'sending', 'connecting', 'starting')
  ORDER BY d.start_time DESC
  LIMIT 200
$function$;

REVOKE EXECUTE ON FUNCTION public.get_cron_recent_failures(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_recent_failures(integer) TO service_role;