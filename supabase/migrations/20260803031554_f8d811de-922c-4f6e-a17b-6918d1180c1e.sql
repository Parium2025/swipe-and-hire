CREATE OR REPLACE FUNCTION public.purge_completed_deletion_rows()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.account_deletion_queue
  WHERE status = 'completed' AND completed_at < now() - interval '90 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_completed_deletion_rows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_completed_deletion_rows() TO service_role;

SELECT cron.unschedule('purge-completed-deletion-rows')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-completed-deletion-rows');

SELECT cron.schedule(
  'purge-completed-deletion-rows',
  '30 3 * * *',
  $$SELECT public.purge_completed_deletion_rows();$$
);