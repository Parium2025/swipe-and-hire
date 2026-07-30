REVOKE EXECUTE ON FUNCTION public.record_app_exception(uuid, text, text, text, text, text, text, text, text, integer, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_app_exception_count(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_job_view(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_job_view(uuid, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.try_uuid(text) FROM anon;