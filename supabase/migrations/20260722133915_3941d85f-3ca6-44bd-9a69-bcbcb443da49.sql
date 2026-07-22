REVOKE ALL ON FUNCTION public.republish_job(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.republish_job(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.republish_job(uuid, int) TO authenticated;