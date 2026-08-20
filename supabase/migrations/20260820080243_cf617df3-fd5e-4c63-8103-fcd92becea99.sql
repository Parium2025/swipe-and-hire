CREATE OR REPLACE FUNCTION public.purge_old_outreach_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.outreach_dispatch_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_outreach_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_outreach_logs() TO service_role;

SELECT cron.unschedule('purge-outreach-logs-nightly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-outreach-logs-nightly');

SELECT cron.schedule(
  'purge-outreach-logs-nightly',
  '15 3 * * *',
  $cron$ SELECT public.purge_old_outreach_logs(); $cron$
);