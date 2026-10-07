CREATE OR REPLACE FUNCTION public.complete_employer_welcome(p_profile jsonb, p_preferences jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current public.profiles%ROWTYPE;
  v_next public.profiles%ROWTYPE;
  v_type text;
  v_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_current FROM public.profiles WHERE user_id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_current.role <> 'employer' THEN RAISE EXCEPTION 'Employer profile required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND is_active=true AND role IN ('admin','recruiter')) THEN RAISE EXCEPTION 'Active employer membership required' USING ERRCODE='42501'; END IF;
  -- The lock serializes concurrent submissions. A stale second draft writes nothing.
  IF v_current.onboarding_completed IS TRUE THEN RETURN 'already_completed'; END IF;
  IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object' OR jsonb_typeof(p_preferences) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid welcome payload'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_profile) AS k(key) WHERE key NOT IN ('first_name','last_name','profile_image_url','company_name','company_logo_url','industry','employee_count','address','website','company_description','interview_video_link','interview_video_default_message','interview_default_message','interview_office_address','interview_office_instructions')) THEN RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE='42501'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='admin' AND is_active=true AND organization_id IS NOT DISTINCT FROM v_current.organization_id) INTO v_admin;
  IF (NOT v_admin OR v_current.joined_via_invite IS TRUE) AND p_profile ?| ARRAY['company_name','company_logo_url','industry','employee_count','address','website','company_description'] THEN RAISE EXCEPTION 'Company fields cannot be changed in this welcome flow' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_preferences) AS e(key,value) WHERE key NOT IN ('new_application:push','new_application:email','new_application:in_app','new_message:push','new_message:email','new_message:in_app','interview_response:push','interview_response:email','interview_response:in_app') OR jsonb_typeof(value) <> 'boolean') THEN RAISE EXCEPTION 'Invalid notification choice'; END IF;
  v_next := jsonb_populate_record(v_current, p_profile);
  IF nullif(trim(v_next.interview_video_link),'') IS NULL THEN RAISE EXCEPTION 'Video link required'; END IF;
  IF NOT coalesce(v_current.joined_via_invite,false) AND nullif(trim(v_next.company_name),'') IS NULL THEN RAISE EXCEPTION 'Company name required'; END IF;
  UPDATE public.profiles SET
    first_name=v_next.first_name,last_name=v_next.last_name,profile_image_url=v_next.profile_image_url,
    company_name=v_next.company_name,company_logo_url=v_next.company_logo_url,industry=v_next.industry,
    employee_count=v_next.employee_count,address=v_next.address,website=v_next.website,company_description=v_next.company_description,
    interview_video_link=v_next.interview_video_link,interview_video_default_message=v_next.interview_video_default_message,
    interview_default_message=v_next.interview_default_message,interview_office_address=v_next.interview_office_address,
    interview_office_instructions=v_next.interview_office_instructions,onboarding_completed=true,updated_at=now()
  WHERE user_id=v_uid;
  FOREACH v_type IN ARRAY ARRAY['new_application','new_message','interview_response'] LOOP
    IF p_preferences ?| ARRAY[v_type||':push',v_type||':email',v_type||':in_app'] THEN
      INSERT INTO public.notification_preferences(user_id,notification_type,is_enabled,email_enabled,in_app_enabled,updated_at)
      SELECT v_uid,v_type,
        coalesce((p_preferences->>(v_type||':push'))::boolean,np.is_enabled,true),
        coalesce((p_preferences->>(v_type||':email'))::boolean,np.email_enabled,v_type='interview_response'),
        coalesce((p_preferences->>(v_type||':in_app'))::boolean,np.in_app_enabled,v_type<>'interview_response'),now()
      FROM (SELECT 1) AS seed LEFT JOIN public.notification_preferences np ON np.user_id=v_uid AND np.notification_type=v_type
      ON CONFLICT (user_id,notification_type) DO UPDATE SET is_enabled=EXCLUDED.is_enabled,email_enabled=EXCLUDED.email_enabled,in_app_enabled=EXCLUDED.in_app_enabled,updated_at=EXCLUDED.updated_at;
    END IF;
  END LOOP;
  RETURN 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.complete_employer_welcome(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_employer_welcome(jsonb,jsonb) TO authenticated;
COMMENT ON FUNCTION public.complete_employer_welcome(jsonb,jsonb) IS 'Own-account first-completion-wins atomic welcome save; locks the profile before any writes. Replay accounts must not call this function.';