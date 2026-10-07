CREATE OR REPLACE FUNCTION public.complete_jobseeker_welcome(p_profile jsonb, p_consent boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current public.profiles%ROWTYPE;
  v_next public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_current FROM public.profiles WHERE user_id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_current.role IS DISTINCT FROM 'job_seeker' THEN RAISE EXCEPTION 'Jobseeker profile required' USING ERRCODE='42501'; END IF;
  IF v_current.onboarding_completed IS TRUE THEN RETURN 'already_completed'; END IF;
  IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object' OR p_consent IS NULL THEN RAISE EXCEPTION 'Invalid welcome payload'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_profile) AS k(key) WHERE key NOT IN ('first_name','last_name','bio','location','city','postal_code','phone','birth_date','employment_type','work_schedule','availability','interests','cv_url','profile_file_name','profile_image_url','video_url','cover_image_url')) THEN RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE='42501'; END IF;
  v_next := jsonb_populate_record(v_current,p_profile);
  UPDATE public.profiles SET first_name=v_next.first_name,last_name=v_next.last_name,bio=v_next.bio,location=v_next.location,city=v_next.city,postal_code=v_next.postal_code,phone=v_next.phone,birth_date=v_next.birth_date,employment_type=v_next.employment_type,work_schedule=v_next.work_schedule,availability=v_next.availability,interests=v_next.interests,cv_url=v_next.cv_url,profile_file_name=v_next.profile_file_name,profile_image_url=v_next.profile_image_url,video_url=v_next.video_url,cover_image_url=v_next.cover_image_url,onboarding_completed=true,updated_at=now() WHERE user_id=v_uid;
  IF p_consent THEN
    INSERT INTO public.user_data_consents(user_id,consent_given,consent_date) VALUES(v_uid,true,now())
    ON CONFLICT(user_id) DO UPDATE SET consent_given=true,consent_date=EXCLUDED.consent_date,updated_at=now();
  END IF;
  RETURN 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.complete_jobseeker_welcome(jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_jobseeker_welcome(jsonb,boolean) TO authenticated;
COMMENT ON FUNCTION public.complete_jobseeker_welcome(jsonb,boolean) IS 'Own-account atomic first-completion-wins profile and consent save.';