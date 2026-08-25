REVOKE EXECUTE ON FUNCTION public.count_external_applications(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_external_applications(uuid) TO service_role;