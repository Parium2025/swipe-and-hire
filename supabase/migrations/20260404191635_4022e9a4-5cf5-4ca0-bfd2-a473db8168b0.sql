
-- Fix search_path on get_applicant_profile_media_batch
CREATE OR REPLACE FUNCTION public.get_applicant_profile_media_batch(p_applicant_ids uuid[], p_employer_id uuid)
 RETURNS TABLE(applicant_id uuid, profile_image_url text, video_url text, is_profile_video boolean, last_active_at timestamp with time zone, city text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    
    SELECT DISTINCT pvp.profile_id as applicant_id
    FROM public.profile_view_permissions pvp
    WHERE pvp.profile_id = ANY(p_applicant_ids)
      AND pvp.viewer_id = p_employer_id
      AND (pvp.expires_at IS NULL OR pvp.expires_at > now())
  )
  SELECT 
    p.user_id as applicant_id,
    p.profile_image_url,
    p.video_url,
    p.is_profile_video,
    p.last_active_at,
    p.city
  FROM public.profiles p
  WHERE p.user_id IN (SELECT aa.applicant_id FROM authorized_applicants aa);
END;
$function$;

-- Fix search_path on search_jobs
CREATE OR REPLACE FUNCTION public.search_jobs(p_search_query text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_county text DEFAULT NULL::text, p_employment_types text[] DEFAULT NULL::text[], p_category text DEFAULT NULL::text, p_salary_min integer DEFAULT NULL::integer, p_salary_max integer DEFAULT NULL::integer, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, title text, description text, location text, workplace_city text, workplace_county text, workplace_municipality text, workplace_address text, workplace_name text, workplace_postal_code text, employment_type text, work_schedule text, salary_min integer, salary_max integer, salary_type text, salary_transparency text, positions_count integer, occupation text, category text, pitch text, requirements text, benefits text[], remote_work_possible text, work_location_type text, contact_email text, application_instructions text, job_image_url text, job_image_desktop_url text, employer_id uuid, is_active boolean, views_count integer, applications_count integer, created_at timestamp with time zone, updated_at timestamp with time zone, expires_at timestamp with time zone, search_rank real, image_focus_position text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tsquery tsquery;
BEGIN
  IF p_search_query IS NOT NULL AND p_search_query <> '' THEN
    v_tsquery := to_tsquery('simple', 
      array_to_string(
        array(
          SELECT word || ':*' 
          FROM unnest(string_to_array(trim(p_search_query), ' ')) AS word 
          WHERE word <> ''
        ), 
        ' & '
      )
    );
  END IF;

  RETURN QUERY
  SELECT 
    jp.id, jp.title, jp.description, jp.location,
    jp.workplace_city, jp.workplace_county, jp.workplace_municipality,
    jp.workplace_address, jp.workplace_name, jp.workplace_postal_code,
    jp.employment_type, jp.work_schedule,
    jp.salary_min, jp.salary_max, jp.salary_type, jp.salary_transparency,
    jp.positions_count, jp.occupation, jp.category, jp.pitch, jp.requirements,
    jp.benefits, jp.remote_work_possible, jp.work_location_type,
    jp.contact_email, jp.application_instructions,
    jp.job_image_url, jp.job_image_desktop_url,
    jp.employer_id, jp.is_active, jp.views_count, jp.applications_count,
    jp.created_at, jp.updated_at, jp.expires_at,
    CASE 
      WHEN v_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_tsquery)
      ELSE 0.0
    END::real as search_rank,
    jp.image_focus_position
  FROM public.job_postings jp
  WHERE 
    jp.is_active = true
    AND jp.deleted_at IS NULL
    AND (v_tsquery IS NULL OR jp.search_vector @@ v_tsquery)
    AND (p_city IS NULL OR p_city = '' OR 
         jp.workplace_city ILIKE '%' || p_city || '%' OR
         jp.workplace_municipality ILIKE '%' || p_city || '%' OR
         jp.location ILIKE '%' || p_city || '%' OR
         jp.workplace_county ILIKE '%' || p_city || '%')
    AND (p_county IS NULL OR p_county = '' OR jp.workplace_county = p_county)
    AND (p_employment_types IS NULL OR array_length(p_employment_types, 1) IS NULL OR 
         jp.employment_type = ANY(p_employment_types))
    AND (p_category IS NULL OR p_category = '' OR jp.category = p_category)
    AND (p_salary_min IS NULL OR jp.salary_max >= p_salary_min OR jp.salary_max IS NULL)
    AND (p_salary_max IS NULL OR jp.salary_min <= p_salary_max OR jp.salary_min IS NULL)
    AND (p_cursor_created_at IS NULL OR jp.created_at < p_cursor_created_at)
  ORDER BY 
    CASE WHEN v_tsquery IS NOT NULL THEN ts_rank(jp.search_vector, v_tsquery) ELSE 0 END DESC,
    jp.created_at DESC
  LIMIT p_limit
  OFFSET CASE WHEN p_cursor_created_at IS NULL THEN p_offset ELSE 0 END;
END;
$function$;
