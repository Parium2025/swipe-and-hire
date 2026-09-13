REVOKE EXECUTE ON FUNCTION public.decrement_job_applications_count() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.emit_profile_change_signal() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_jobseeker_note(p_content text, p_expected_revision bigint, p_expected_user_id uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_applicant_profile_media(p_applicant_id uuid, p_employer_id uuid) FROM authenticated, anon, PUBLIC;