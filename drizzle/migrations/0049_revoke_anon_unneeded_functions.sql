REVOKE EXECUTE ON FUNCTION public.enforce_saved_jobs_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_interview_response_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_image_library_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_image_library_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_saved_jobs_free_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.post_interview_response_chat_message() TO service_role;