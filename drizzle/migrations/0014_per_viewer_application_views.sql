CREATE TABLE IF NOT EXISTS public.job_application_views (
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_job_application_views_viewer ON public.job_application_views(viewer_id);

GRANT SELECT, INSERT ON public.job_application_views TO authenticated;
GRANT ALL ON public.job_application_views TO service_role;

ALTER TABLE public.job_application_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers read own application views"
ON public.job_application_views
FOR SELECT
TO authenticated
USING (viewer_id = auth.uid());

CREATE POLICY "Viewers insert own application views"
ON public.job_application_views
FOR INSERT
TO authenticated
WITH CHECK (viewer_id = auth.uid() AND public.can_view_job_application(application_id));

-- Historik: befintliga "sedda" ansökningar tillskrivs annonsens ägare, så att
-- ingen plötsligt får tillbaka tusentals gamla olästa.
INSERT INTO public.job_application_views (application_id, viewer_id, viewed_at)
SELECT ja.id, jp.employer_id, ja.viewed_at
FROM public.job_applications ja
JOIN public.job_postings jp ON jp.id = ja.job_id
WHERE ja.viewed_at IS NOT NULL AND jp.employer_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.mark_application_viewed(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_job_application(p_application_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.job_application_views (application_id, viewer_id)
  VALUES (p_application_id, auth.uid())
  ON CONFLICT (application_id, viewer_id) DO NOTHING;

  UPDATE public.job_applications
  SET viewed_at = now()
  WHERE id = p_application_id AND viewed_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_application_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_application_viewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_application_viewed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_employer_unviewed_application_counts()
RETURNS TABLE(job_id uuid, unviewed_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  org AS (SELECT public.get_user_organization_id((SELECT uid FROM me)) AS org_id),
  internal AS (
    SELECT ur.user_id
    FROM public.user_roles ur, org
    WHERE org.org_id IS NOT NULL
      AND ur.organization_id = org.org_id
      AND ur.is_active = true
    UNION
    SELECT uid FROM me
  ),
  allowed AS (
    SELECT jp.id
    FROM public.job_postings jp
    WHERE (SELECT uid FROM me) IS NOT NULL
      AND jp.deleted_at IS NULL
      AND (
        jp.employer_id = (SELECT uid FROM me)
        OR jp.employer_id IN (SELECT user_id FROM internal)
      )
  )
  SELECT ja.job_id, count(*)::int
  FROM public.job_applications ja
  WHERE ja.job_id IN (SELECT id FROM allowed)
    AND ja.hidden_by_applicant_at IS NULL
    AND ja.applicant_id NOT IN (SELECT user_id FROM internal)
    AND NOT EXISTS (
      SELECT 1 FROM public.job_application_views v
      WHERE v.application_id = ja.id AND v.viewer_id = (SELECT uid FROM me)
    )
  GROUP BY ja.job_id;
$function$;

REVOKE ALL ON FUNCTION public.get_employer_unviewed_application_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_unviewed_application_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_unviewed_application_counts() TO service_role;