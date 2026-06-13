
CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  viewed_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.profile_views TO authenticated;
GRANT ALL ON public.profile_views TO service_role;

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Jobbsökaren ser sina egna profilvisningar
CREATE POLICY "Viewed user can read own profile views"
  ON public.profile_views FOR SELECT
  TO authenticated
  USING (auth.uid() = viewed_user_id);

-- Arbetsgivare ser de visningar de gjort (eller andra i samma org)
CREATE POLICY "Viewer or org can read own viewing history"
  ON public.profile_views FOR SELECT
  TO authenticated
  USING (
    auth.uid() = viewer_user_id
    OR (
      viewer_org_id IS NOT NULL
      AND viewer_org_id = public.get_user_organization_id(auth.uid())
    )
  );

-- Endast insert via SECURITY DEFINER-funktionen (ingen direkt insert-policy)

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user
  ON public.profile_views(viewed_user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer
  ON public.profile_views(viewer_user_id, viewed_at DESC);

-- Säker logg-funktion med 1-timmes dedupe per tittare+kandidat.
CREATE OR REPLACE FUNCTION public.log_profile_view(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_viewed uuid;
  v_job_id uuid;
  v_employer uuid;
  v_org uuid;
  v_recent boolean;
BEGIN
  IF v_viewer IS NULL OR p_application_id IS NULL THEN
    RETURN;
  END IF;

  SELECT ja.applicant_id, ja.job_id, jp.employer_id
    INTO v_viewed, v_job_id, v_employer
  FROM public.job_applications ja
  JOIN public.job_postings jp ON jp.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF v_viewed IS NULL THEN
    RETURN;
  END IF;

  -- Viewer måste antingen äga jobbet eller vara i samma org som employern
  IF v_viewer <> v_employer
     AND NOT public.same_organization(v_viewer, v_employer) THEN
    RETURN;
  END IF;

  -- Logga inte när någon ser sin egen profil
  IF v_viewer = v_viewed THEN
    RETURN;
  END IF;

  -- Dedupe: max en logg per timme per (viewer, viewed)
  SELECT EXISTS(
    SELECT 1 FROM public.profile_views
    WHERE viewer_user_id = v_viewer
      AND viewed_user_id = v_viewed
      AND viewed_at > now() - interval '1 hour'
  ) INTO v_recent;

  IF v_recent THEN
    RETURN;
  END IF;

  v_org := public.get_user_organization_id(v_viewer);

  INSERT INTO public.profile_views (viewer_user_id, viewer_org_id, viewed_user_id, application_id, job_id)
  VALUES (v_viewer, v_org, v_viewed, p_application_id, v_job_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_profile_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_profile_view(uuid) TO authenticated, service_role;

-- Statistik-funktion för jobbsökaren
CREATE OR REPLACE FUNCTION public.get_profile_view_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unique_30d int;
  v_total int;
  v_last_viewed timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('unique_viewers_30d', 0, 'total_views', 0, 'last_viewed_at', null);
  END IF;

  SELECT COUNT(DISTINCT viewer_user_id)::int
    INTO v_unique_30d
  FROM public.profile_views
  WHERE viewed_user_id = p_user_id
    AND viewed_at > now() - interval '30 days';

  SELECT COUNT(*)::int, MAX(viewed_at)
    INTO v_total, v_last_viewed
  FROM public.profile_views
  WHERE viewed_user_id = p_user_id;

  RETURN jsonb_build_object(
    'unique_viewers_30d', COALESCE(v_unique_30d, 0),
    'total_views', COALESCE(v_total, 0),
    'last_viewed_at', v_last_viewed
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_view_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_view_stats(uuid) TO authenticated, service_role;
