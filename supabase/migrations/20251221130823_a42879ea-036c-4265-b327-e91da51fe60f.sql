-- Allow authenticated users to call employer/candidate access RPC functions
-- (Required for /candidates to fetch candidate profile media securely)
GRANT EXECUTE ON FUNCTION public.get_applicant_profile_media(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_applicant_profile_image(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consented_profile_for_employer(uuid, uuid) TO authenticated;