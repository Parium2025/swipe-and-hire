CREATE OR REPLACE FUNCTION public.get_total_job_views()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN (SELECT COALESCE(SUM(views_count), 0)::bigint FROM public.job_postings);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_total_job_views() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_total_job_views() TO authenticated, service_role;