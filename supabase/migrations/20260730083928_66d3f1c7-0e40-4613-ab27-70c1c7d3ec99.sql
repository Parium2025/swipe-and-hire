CREATE OR REPLACE FUNCTION public.can_employer_read_application_file(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH owner AS (
    SELECT public.try_uuid((storage.foldername(p_name))[1]) AS uid
  )
  SELECT
    -- 1) Filen är kopplad till en ansökan som arbetsgivaren får se
    EXISTS (
      SELECT 1
      FROM public.job_applications ja, owner o
      WHERE ja.applicant_id = o.uid
        AND p_name IN (ja.cv_url, ja.profile_image_snapshot_url, ja.video_snapshot_url)
        AND public.can_view_job_application(ja.job_id)
    )
    -- 2) Kandidatens nuvarande profilmedia, om hen sökt hos arbetsgivaren
    OR EXISTS (
      SELECT 1
      FROM public.profiles p, owner o
      WHERE p.user_id = o.uid
        AND p_name IN (p.profile_image_url, p.video_url, p.cover_image_url, p.cv_url)
        AND EXISTS (
          SELECT 1 FROM public.job_applications ja2
          WHERE ja2.applicant_id = o.uid
            AND public.can_view_job_application(ja2.job_id)
        )
    )
    -- 3) Uttryckligt profilvisningsmedgivande
    OR EXISTS (
      SELECT 1
      FROM public.profile_view_permissions pvp
      JOIN public.profiles p2 ON p2.user_id = pvp.profile_id
      , owner o
      WHERE pvp.viewer_id = auth.uid()
        AND pvp.profile_id = o.uid
        AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
        AND p_name IN (p2.profile_image_url, p2.video_url, p2.cover_image_url, p2.cv_url)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_employer_read_application_file(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_employer_read_application_file(text) TO authenticated;

DROP POLICY IF EXISTS "Employers can view consented files" ON storage.objects;

CREATE POLICY "Employers can view consented files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-applications'
  AND public.can_employer_read_application_file(name)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_cv_url ON public.job_applications(cv_url);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_job ON public.job_applications(applicant_id, job_id);