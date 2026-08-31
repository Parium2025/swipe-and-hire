-- PROFILE_COLUMN_ACCESS_HARDENING_V1
--
-- profiles previously had a table-wide SELECT grant. PostgreSQL privileges are
-- additive, so the older per-column REVOKEs did not prevent authenticated
-- clients from selecting every column. This migration moves the two legitimate
-- sensitive read paths behind caller-bound RPCs, then replaces table SELECT
-- with an explicit, non-sensitive allowlist.

CREATE OR REPLACE FUNCTION public.get_my_organization_member_profiles()
RETURNS TABLE (
  organization_id uuid,
  user_id uuid,
  role text,
  is_active boolean,
  first_name text,
  last_name text,
  email text,
  profile_image_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_organization_id := public.get_user_organization_id(auth.uid());

  IF v_organization_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles caller_role
    WHERE caller_role.user_id = auth.uid()
      AND caller_role.organization_id = v_organization_id
      AND caller_role.is_active IS TRUE
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    member_role.organization_id,
    member_role.user_id,
    member_role.role,
    member_role.is_active,
    member_profile.first_name,
    member_profile.last_name,
    member_profile.email,
    member_profile.profile_image_url
  FROM public.user_roles member_role
  LEFT JOIN public.profiles member_profile
    ON member_profile.user_id = member_role.user_id
  WHERE member_role.organization_id = v_organization_id
    AND member_role.is_active IS TRUE
  ORDER BY member_role.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_organization_member_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_member_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_organization_member_profiles() TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_profile_media_counts()
RETURNS TABLE (
  video_count bigint,
  cv_count bigint,
  image_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE p.video_url IS NOT NULL),
    count(*) FILTER (WHERE p.cv_url IS NOT NULL),
    count(*) FILTER (WHERE p.profile_image_url IS NOT NULL)
  FROM public.profiles p;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_profile_media_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_profile_media_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_profile_media_counts() TO service_role;

-- Supabase JS 2.83 cannot request a selected subset of Postgres Changes
-- columns. A narrow signal table preserves live invalidation without ever
-- replicating the full profiles row to the browser.
CREATE TABLE IF NOT EXISTS public.profile_change_signals (
  profile_user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 1,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_change_signals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profile_change_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_change_signals TO authenticated;

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
      SELECT 1
      FROM public.profiles target_profile
      WHERE target_profile.user_id = p_profile_user_id
        AND target_profile.role = 'employer'
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles caller_role
      JOIN public.user_roles target_role
        ON target_role.organization_id = caller_role.organization_id
      WHERE caller_role.user_id = auth.uid()
        AND caller_role.is_active IS TRUE
        AND target_role.user_id = p_profile_user_id
        AND target_role.is_active IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_applications application
      JOIN public.job_postings job ON job.id = application.job_id
      WHERE application.applicant_id = p_profile_user_id
        AND (
          job.employer_id = auth.uid()
          OR public.get_user_organization_id(job.employer_id)
             = public.get_user_organization_id(auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.profile_view_permissions permission
      WHERE permission.profile_id = p_profile_user_id
        AND permission.viewer_id = auth.uid()
        AND (permission.expires_at IS NULL OR permission.expires_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM public.my_candidates candidate
      WHERE candidate.applicant_id = p_profile_user_id
        AND candidate.recruiter_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_receive_profile_change_signal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_receive_profile_change_signal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_receive_profile_change_signal(uuid) TO service_role;

DROP POLICY IF EXISTS "Authorized users receive profile change signals"
  ON public.profile_change_signals;
CREATE POLICY "Authorized users receive profile change signals"
ON public.profile_change_signals
FOR SELECT
TO authenticated
USING (public.can_receive_profile_change_signal(profile_user_id));

CREATE OR REPLACE FUNCTION public.emit_profile_change_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_change_signals AS signal (
    profile_user_id,
    revision,
    changed_at
  )
  VALUES (NEW.user_id, 1, now())
  ON CONFLICT (profile_user_id) DO UPDATE
  SET revision = signal.revision + 1,
      changed_at = EXCLUDED.changed_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_profile_change_signal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_emit_change_signal ON public.profiles;
CREATE TRIGGER profiles_emit_change_signal
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.emit_profile_change_signal();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profile_change_signals'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_change_signals';
  END IF;
END;
$$;

-- The old policy allowed anonymous clients to reach every employer row. Keep
-- the job-listing use case, but pair it with the safe column allowlist below.
DROP POLICY IF EXISTS "Public can view employer company info for job listings" ON public.profiles;
DROP POLICY IF EXISTS "Public can view employer safe profile rows" ON public.profiles;
CREATE POLICY "Public can view employer safe profile rows"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (role = 'employer');

-- Remove both table-level and any historical column-level grants first. The
-- existing get_my_profile() RPC remains the full-row path for the owner.
REVOKE SELECT ON public.profiles FROM PUBLIC;
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

REVOKE SELECT (
  address,
  availability,
  background_location_enabled,
  bio,
  birth_date,
  city,
  company_description,
  company_logo_original_url,
  company_logo_url,
  company_name,
  company_social_media_links,
  cover_image_url,
  created_at,
  cv_url,
  email,
  employee_count,
  employment_type,
  first_name,
  home_location,
  id,
  image_updated_at,
  industry,
  interests,
  interview_default_message,
  interview_office_address,
  interview_office_instructions,
  interview_video_default_message,
  interview_video_link,
  is_premium,
  is_profile_video,
  last_active_at,
  last_name,
  location,
  not_currently_looking,
  occupation,
  onboarding_completed,
  org_number,
  organization_id,
  phone,
  postal_code,
  premium_until,
  profile_file_name,
  profile_image_url,
  role,
  social_media_links,
  updated_at,
  user_id,
  video_updated_at,
  video_url,
  website,
  work_schedule
) ON public.profiles FROM PUBLIC, authenticated, anon;

GRANT SELECT (
  id,
  user_id,
  role,
  first_name,
  last_name,
  company_name,
  occupation,
  location,
  profile_image_url,
  company_logo_url,
  onboarding_completed
) ON public.profiles TO authenticated;

GRANT SELECT (
  id,
  user_id,
  role,
  first_name,
  last_name,
  company_name,
  occupation,
  location,
  profile_image_url,
  company_logo_url
) ON public.profiles TO anon;

-- Fail deployment atomically if a future privilege change makes the intended
-- boundary untrue.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'profiles hardening failed: authenticated still has table SELECT';
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'profiles hardening failed: anon still has table SELECT';
  END IF;

  IF has_column_privilege('authenticated', 'public.profiles', 'email', 'SELECT') THEN
    RAISE EXCEPTION 'profiles hardening failed: authenticated can still SELECT email';
  END IF;

  IF has_column_privilege('anon', 'public.profiles', 'email', 'SELECT') THEN
    RAISE EXCEPTION 'profiles hardening failed: anon can still SELECT email';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.profiles', 'first_name', 'SELECT') THEN
    RAISE EXCEPTION 'profiles hardening failed: authenticated cannot SELECT safe display columns';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
