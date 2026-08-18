CREATE OR REPLACE FUNCTION public.can_employer_read_application_file(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH owner AS (
    SELECT public.try_uuid((storage.foldername(p_name))[1]) AS uid
  ),
  base AS (
    -- Posterbilder ligger bredvid videon: <video-utan-ändelse>-poster.jpg
    SELECT CASE
      WHEN p_name LIKE '%-poster.jpg'
        THEN regexp_replace(p_name, '-poster\.jpg$', '')
      ELSE NULL
    END AS poster_base
  )
  SELECT
    EXISTS (
      SELECT 1
      FROM public.job_applications ja, owner o
      WHERE ja.applicant_id = o.uid
        AND p_name IN (ja.cv_url, ja.profile_image_snapshot_url, ja.video_snapshot_url)
        AND public.can_view_job_application(ja.job_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_applications ja, owner o, base b
      WHERE ja.applicant_id = o.uid
        AND b.poster_base IS NOT NULL
        AND ja.video_snapshot_url IS NOT NULL
        AND ja.video_snapshot_url LIKE b.poster_base || '.%'
        AND public.can_view_job_application(ja.job_id)
    )
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
    OR EXISTS (
      SELECT 1
      FROM public.profiles p, owner o, base b
      WHERE p.user_id = o.uid
        AND b.poster_base IS NOT NULL
        AND p.video_url IS NOT NULL
        AND p.video_url LIKE b.poster_base || '.%'
        AND EXISTS (
          SELECT 1 FROM public.job_applications ja3
          WHERE ja3.applicant_id = o.uid
            AND public.can_view_job_application(ja3.job_id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.profile_view_permissions pvp
      JOIN public.profiles p2 ON p2.user_id = pvp.profile_id
      , owner o, base b
      WHERE pvp.viewer_id = auth.uid()
        AND pvp.profile_id = o.uid
        AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
        AND (
          p_name IN (p2.profile_image_url, p2.video_url, p2.cover_image_url, p2.cv_url)
          OR (b.poster_base IS NOT NULL AND p2.video_url IS NOT NULL AND p2.video_url LIKE b.poster_base || '.%')
        )
    );
$function$;