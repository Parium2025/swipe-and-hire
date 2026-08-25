CREATE OR REPLACE FUNCTION public.get_public_job(p_job_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT json_build_object('job', to_jsonb(t))
     FROM (
       SELECT jp.id, jp.title, jp.description, jp.requirements, jp.location, jp.occupation,
              jp.employment_type, jp.work_schedule, jp.salary_min, jp.salary_max, jp.salary_type,
              jp.salary_transparency, jp.workplace_city, jp.workplace_county, jp.workplace_postal_code,
              jp.workplace_address, jp.workplace_name, jp.company_logo_url, jp.job_image_url,
              jp.benefits, jp.created_at, jp.expires_at, jp.is_active, jp.positions_count,
              jp.remote_work_possible, jp.work_location_type
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_job(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_job_facets()
RETURNS TABLE(city text, occupation text, job_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(NULLIF(btrim(COALESCE(jp.workplace_city, jp.location, '')), ''), '') AS city,
         COALESCE(NULLIF(btrim(COALESCE(jp.occupation, '')), ''), '') AS occupation,
         count(*)::int AS job_count
  FROM public.job_postings jp
  WHERE jp.is_active = true
    AND jp.deleted_at IS NULL
    AND (jp.expires_at IS NULL OR jp.expires_at > now())
  GROUP BY 1, 2
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_job_facets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_job_facets() TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_my_candidates_list_id ON public.my_candidates (list_id);
CREATE INDEX IF NOT EXISTS idx_conversation_blocks_conversation ON public.conversation_blocks (conversation_id);