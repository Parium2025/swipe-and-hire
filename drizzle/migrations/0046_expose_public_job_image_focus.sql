CREATE OR REPLACE FUNCTION public.get_public_job(p_job_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT json_build_object('job', to_jsonb(t))
     FROM (
       SELECT
         jp.id,
         jp.title,
         CASE WHEN auth.uid() IS NULL THEN left(regexp_replace(coalesce(jp.description, ''), E'\\s+', ' ', 'g'), 300) ELSE jp.description END AS description,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.requirements END AS requirements,
         jp.location,
         jp.occupation,
         jp.employment_type,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.work_schedule END AS work_schedule,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.salary_min END AS salary_min,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.salary_max END AS salary_max,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.salary_type END AS salary_type,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.salary_transparency END AS salary_transparency,
         jp.workplace_city,
         jp.workplace_county,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.workplace_postal_code END AS workplace_postal_code,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.workplace_address END AS workplace_address,
         jp.workplace_name,
         jp.company_logo_url,
         jp.job_image_url,
         jp.job_image_desktop_url,
         jp.image_focus_position_desktop,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.benefits END AS benefits,
         jp.created_at,
         jp.expires_at,
         jp.is_active,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.positions_count END AS positions_count,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.remote_work_possible END AS remote_work_possible,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE jp.work_location_type END AS work_location_type
       FROM public.job_postings jp
       WHERE jp.id = p_job_id
         AND jp.is_active = true
         AND jp.deleted_at IS NULL
         AND (jp.expires_at IS NULL OR jp.expires_at > now())
     ) t),
    (SELECT json_build_object('expired', json_build_object('title', jp.title, 'occupation', jp.occupation))
     FROM public.job_postings jp
     WHERE jp.id = p_job_id),
    '{}'::json
  )
$function$;

REVOKE EXECUTE ON FUNCTION public.get_public_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_job(uuid) TO anon, authenticated, service_role;