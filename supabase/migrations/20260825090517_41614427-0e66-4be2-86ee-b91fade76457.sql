CREATE OR REPLACE FUNCTION public.get_org_default_interview_video_link()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.interview_video_link
  FROM public.profiles p
  WHERE p.organization_id IS NOT NULL
    AND p.organization_id = public.get_user_organization_id(auth.uid())
    AND COALESCE(p.interview_video_link, '') <> ''
  ORDER BY (p.user_id = auth.uid()) DESC, p.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_org_default_interview_video_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_default_interview_video_link() TO authenticated;