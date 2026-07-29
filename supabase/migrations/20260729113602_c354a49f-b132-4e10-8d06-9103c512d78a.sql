REVOKE EXECUTE ON FUNCTION public.run_data_retention() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.run_data_retention() TO service_role, postgres;