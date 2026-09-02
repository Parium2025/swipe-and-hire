CREATE OR REPLACE FUNCTION public.can_receive_profile_change_signal(p_profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_profile_user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles caller_role JOIN public.user_roles target_role ON target_role.organization_id = caller_role.organization_id
      WHERE caller_role.user_id = auth.uid() AND caller_role.is_active IS TRUE AND target_role.user_id = p_profile_user_id AND target_role.is_active IS TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.job_applications application JOIN public.job_postings job ON job.id = application.job_id
      WHERE application.applicant_id = p_profile_user_id AND (
        job.employer_id = auth.uid() OR public.get_user_organization_id(job.employer_id) = public.get_user_organization_id(auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.job_applications application JOIN public.job_postings job ON job.id = application.job_id
      WHERE application.applicant_id = auth.uid() AND (
        job.employer_id = p_profile_user_id OR public.get_user_organization_id(job.employer_id) = public.get_user_organization_id(p_profile_user_id)
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.conversation_members caller_member
      JOIN public.conversation_members target_member ON target_member.conversation_id = caller_member.conversation_id
      WHERE caller_member.user_id = auth.uid() AND target_member.user_id = p_profile_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profile_view_permissions permission
      WHERE permission.profile_id = p_profile_user_id AND permission.viewer_id = auth.uid()
        AND (permission.expires_at IS NULL OR permission.expires_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.my_candidates candidate
      WHERE candidate.applicant_id = p_profile_user_id AND candidate.recruiter_id = auth.uid()
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_receive_profile_change_signal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_receive_profile_change_signal(uuid) TO authenticated, service_role;