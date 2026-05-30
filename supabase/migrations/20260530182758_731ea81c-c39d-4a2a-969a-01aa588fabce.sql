ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS image_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS video_updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.bump_profile_media_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_image_url IS DISTINCT FROM OLD.profile_image_url THEN
    NEW.image_updated_at = now();
  END IF;
  IF NEW.video_url IS DISTINCT FROM OLD.video_url THEN
    NEW.video_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_profile_media_updated_at ON public.profiles;
CREATE TRIGGER trg_bump_profile_media_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.bump_profile_media_updated_at();

DROP FUNCTION IF EXISTS public.get_applicant_profile_media_batch(uuid[], uuid);

CREATE OR REPLACE FUNCTION public.get_applicant_profile_media_batch(
  p_applicant_ids uuid[],
  p_employer_id uuid
)
RETURNS TABLE(
  applicant_id uuid,
  profile_image_url text,
  video_url text,
  is_profile_video boolean,
  last_active_at timestamptz,
  city text,
  image_updated_at timestamptz,
  video_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employer_org_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_employer_id THEN
    RETURN;
  END IF;

  v_employer_org_id := get_user_organization_id(p_employer_id);

  RETURN QUERY
  WITH authorized_applicants AS (
    SELECT DISTINCT ja.applicant_id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND jp.employer_id = p_employer_id

    UNION

    SELECT DISTINCT ja.applicant_id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    JOIN public.user_roles ur ON ur.user_id = jp.employer_id
    WHERE ja.applicant_id = ANY(p_applicant_ids)
      AND v_employer_org_id IS NOT NULL
      AND ur.organization_id = v_employer_org_id
      AND ur.is_active = true

    UNION

    SELECT DISTINCT pvp.profile_id AS applicant_id
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = ANY(p_applicant_ids)
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
  SELECT
    p.user_id AS applicant_id,
    p.profile_image_url,
    p.video_url,
    p.is_profile_video,
    p.last_active_at,
    p.city,
    p.image_updated_at,
    p.video_updated_at
  FROM public.profiles p
  WHERE p.user_id IN (SELECT aa.applicant_id FROM authorized_applicants aa);
END;
$$;