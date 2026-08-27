REVOKE EXECUTE ON FUNCTION public.can_add_conversation_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_distinct_candidates_scoped(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_job_applications_per_stage(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_employer_inbox_stats(uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_job_published_at() FROM anon, authenticated;