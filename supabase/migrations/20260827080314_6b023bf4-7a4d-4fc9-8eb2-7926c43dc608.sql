REVOKE EXECUTE ON FUNCTION public.can_add_conversation_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_add_conversation_member(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.count_distinct_candidates_scoped(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_distinct_candidates_scoped(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.count_job_applications_per_stage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_job_applications_per_stage(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_employer_inbox_stats(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_inbox_stats(uuid, uuid[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.guard_job_published_at() FROM PUBLIC, anon, authenticated;