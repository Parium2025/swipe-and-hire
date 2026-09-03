REVOKE EXECUTE ON FUNCTION public.get_user_organization_id(uuid) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_organization_id(uuid) TO service_role;