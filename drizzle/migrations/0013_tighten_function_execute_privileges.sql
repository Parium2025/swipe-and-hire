REVOKE EXECUTE ON FUNCTION public.enforce_applicant_application_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_applicant_interview_update() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_applied_to_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_applied_to_job(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_outreach_templates_atomic(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_outreach_templates_atomic(uuid, uuid, text, jsonb) TO authenticated;