CREATE OR REPLACE FUNCTION public.has_active_plan(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND auth.uid() = _user_id
    AND EXISTS (SELECT 1 FROM public.get_active_plan_details(_user_id));
$function$;
REVOKE EXECUTE ON FUNCTION public.has_active_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_plan(uuid) TO authenticated, service_role;