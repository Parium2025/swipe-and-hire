REVOKE ALL ON FUNCTION public.get_applicant_profile_image(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_applicant_profile_image(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_consented_profile_for_employer(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_consented_profile_for_employer(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_employer_jobs_page(text, text, text, text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_jobs_page(text, text, text, text, uuid, integer, integer) TO service_role;