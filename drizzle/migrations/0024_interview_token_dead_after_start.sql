CREATE OR REPLACE FUNCTION public.respond_to_interview_by_token(p_token uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.interview_email_tokens%ROWTYPE;
  v_interview public.interviews%ROWTYPE;
  v_job_title text;
  v_new_status text;
  v_company text;
  v_employer_email text;
  v_employer_name text;
  v_candidate_name text;
  v_details jsonb;
BEGIN
  SELECT * INTO v_row FROM public.interview_email_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT * INTO v_interview FROM public.interviews WHERE id = v_row.interview_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  SELECT title INTO v_job_title FROM public.job_postings WHERE id = v_interview.job_id;

  IF v_interview.status IN ('cancelled', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'status', v_interview.status, 'job_title', v_job_title);
  END IF;

  -- Länken dör när mötet börjat: efter starttiden ska ingen kunna ändra
  -- svaret via mejllänken.
  IF v_interview.scheduled_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'started', 'status', v_interview.status, 'job_title', v_job_title);
  END IF;

  v_new_status := CASE WHEN p_accept THEN 'confirmed' ELSE 'declined' END;

  SELECT company_name INTO v_company FROM public.profiles WHERE id = v_interview.employer_id;
  SELECT email INTO v_employer_email FROM auth.users WHERE id = v_interview.employer_id;
  SELECT NULLIF(TRIM(COALESCE(first_name, '')), '') INTO v_employer_name
  FROM public.profiles WHERE id = v_interview.employer_id;

  SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  INTO v_candidate_name
  FROM public.job_applications
  WHERE applicant_id = v_interview.applicant_id AND job_id = v_interview.job_id
  LIMIT 1;

  v_details := jsonb_build_object(
    'interview_id', v_interview.id,
    'employer_id', v_interview.employer_id,
    'employer_email', v_employer_email,
    'employer_name', v_employer_name,
    'company_name', v_company,
    'candidate_name', COALESCE(v_candidate_name, 'Kandidaten'),
    'job_title', v_job_title,
    'scheduled_at', v_interview.scheduled_at,
    'duration_minutes', v_interview.duration_minutes,
    'location_details', v_interview.location_details
  );

  IF v_interview.status = v_new_status THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', v_new_status, 'job_title', v_job_title, 'scheduled_at', v_interview.scheduled_at) || v_details;
  END IF;

  -- Notisfunktionen läser detta för att veta att kandidaten svarade,
  -- eftersom auth.uid() saknas när svaret kommer via mejllänken.
  PERFORM set_config('app.interview_actor_id', v_row.applicant_id::text, true);

  UPDATE public.interviews
  SET status = v_new_status
  WHERE id = v_row.interview_id;

  UPDATE public.interview_email_tokens
  SET used_at = now(), used_answer = v_new_status
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'already', false, 'status', v_new_status, 'job_title', v_job_title, 'scheduled_at', v_interview.scheduled_at) || v_details;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_interview_by_token(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_interview_by_token(uuid, boolean) TO service_role;