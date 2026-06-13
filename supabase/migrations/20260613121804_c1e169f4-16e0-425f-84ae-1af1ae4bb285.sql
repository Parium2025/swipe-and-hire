REVOKE EXECUTE ON FUNCTION public.has_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_premium(uuid) TO authenticated, service_role;