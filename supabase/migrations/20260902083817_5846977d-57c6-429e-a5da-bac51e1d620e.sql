REVOKE SELECT ON TABLE public.job_postings FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_job(p_job_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.get_employer_public_profile(target_user_id uuid)
RETURNS TABLE(user_id uuid, company_name text, company_logo_url text, company_description text, website text, industry text, employee_count text, address text, org_number text, company_social_media_links json, first_name text, last_name text, role user_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.company_name, p.company_logo_url,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.company_description END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.website END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.industry END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.employee_count END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.address END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.org_number END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.company_social_media_links END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.first_name END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.last_name END,
         p.role
  FROM public.profiles p
  WHERE p.user_id = target_user_id
    AND p.role = 'employer';
$function$;

CREATE OR REPLACE FUNCTION public.get_employer_public_profiles(target_user_ids uuid[])
RETURNS TABLE(user_id uuid, company_name text, company_logo_url text, company_description text, website text, industry text, employee_count text, address text, org_number text, company_social_media_links json, first_name text, last_name text, role user_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.company_name, p.company_logo_url,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.company_description END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.website END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.industry END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.employee_count END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.address END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.org_number END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.company_social_media_links END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.first_name END,
         CASE WHEN auth.uid() IS NULL THEN NULL ELSE p.last_name END,
         p.role
  FROM public.profiles p
  WHERE p.user_id = ANY(target_user_ids)
    AND p.role = 'employer';
$function$;

CREATE OR REPLACE FUNCTION public.has_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR auth.uid() <> p_user_id THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = p_user_id
        AND (is_premium = true OR (premium_until IS NOT NULL AND premium_until > now()))
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.record_app_exception(_owner_user_id uuid, _environment text, _kind text, _severity text, _title text, _message text, _route text, _source text, _stacktrace text, _http_status integer, _fingerprint text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
  v_admin_id uuid;
  v_alert_body text;
  v_alert_metadata jsonb;
  v_env text;
  v_fingerprint text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _owner_user_id THEN
    RAISE EXCEPTION 'Not allowed to record exceptions for this owner';
  END IF;

  IF pg_column_size(COALESCE(_metadata, '{}'::jsonb)) > 16384 THEN
    RAISE EXCEPTION 'Exception metadata is too large' USING ERRCODE = '22023';
  END IF;

  IF NOT public.consume_rate_limit('app-exception:' || _owner_user_id::text, 60, 3600) THEN
    RAISE EXCEPTION 'Too many exception reports' USING ERRCODE = 'P0001';
  END IF;

  v_env := LEFT(COALESCE(NULLIF(trim(_environment), ''), 'production'), 40);
  v_fingerprint := LEFT(COALESCE(NULLIF(_fingerprint, ''), md5(COALESCE(_message, '') || COALESCE(_route, ''))), 200);

  INSERT INTO public.app_exceptions (
    owner_user_id, environment, kind, severity, title, message, route, source,
    stacktrace, http_status, fingerprint, metadata
  ) VALUES (
    _owner_user_id, v_env,
    LEFT(COALESCE(NULLIF(_kind, ''), 'runtime_error'), 80),
    CASE WHEN _severity = 'critical' THEN 'critical' ELSE 'warning' END,
    LEFT(COALESCE(NULLIF(_title, ''), 'Appfel upptäckt'), 180),
    LEFT(COALESCE(NULLIF(_message, ''), 'Okänt fel'), 2000),
    LEFT(COALESCE(NULLIF(_route, ''), '/'), 500),
    NULLIF(LEFT(COALESCE(_source, ''), 1000), ''),
    NULLIF(LEFT(COALESCE(_stacktrace, ''), 4000), ''),
    CASE WHEN _http_status BETWEEN 100 AND 599 THEN _http_status ELSE NULL END,
    v_fingerprint,
    COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (owner_user_id, fingerprint)
  DO UPDATE SET
    severity = EXCLUDED.severity, title = EXCLUDED.title, message = EXCLUDED.message,
    route = EXCLUDED.route, source = EXCLUDED.source, stacktrace = EXCLUDED.stacktrace,
    http_status = EXCLUDED.http_status, metadata = EXCLUDED.metadata,
    occurrence_count = public.app_exceptions.occurrence_count + 1,
    last_seen_at = now(), updated_at = now()
  RETURNING id INTO v_id;

  IF v_env <> 'production' THEN RETURN v_id; END IF;

  v_alert_body := LEFT(COALESCE(NULLIF(_message, ''), 'Okänt fel') || ' (' || COALESCE(NULLIF(_route, ''), '/') || ')', 900);
  v_alert_metadata := jsonb_build_object(
    'route', COALESCE(NULLIF(_route, ''), '/status'),
    'area', COALESCE(NULLIF(_kind, ''), 'runtime_error'),
    'status', CASE WHEN _severity = 'critical' THEN 'critical' ELSE 'warning' END,
    'source', LEFT(COALESCE(_source, ''), 1000),
    'httpStatus', COALESCE(_http_status::text, ''),
    'fingerprint', v_fingerprint,
    'exceptionId', v_id,
    'reporterUserId', _owner_user_id
  );

  FOR v_admin_id IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.is_active = true AND ur.user_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_admin_id AND n.type = 'system_app_failure'
        AND n.created_at > now() - interval '15 minutes'
        AND n.metadata->>'fingerprint' = v_fingerprint
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (v_admin_id, 'system_app_failure', LEFT(COALESCE(NULLIF(_title, ''), 'Appfel upptäckt'), 180), v_alert_body, v_alert_metadata);
      BEGIN
        PERFORM public.dispatch_interview_push(v_admin_id, LEFT(COALESCE(NULLIF(_title, ''), 'Appfel upptäckt'), 180), v_alert_body, v_alert_metadata);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'App exception push alert failed for %: %', v_admin_id, SQLERRM;
      END;
    END IF;
  END LOOP;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purge_old_outreach_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_outreach_logs() TO service_role;