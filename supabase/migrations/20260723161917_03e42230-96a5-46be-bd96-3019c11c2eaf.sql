-- Allow republish_job to bypass the fingerprint duplicate guard.
-- Republish is an explicit user action that legitimately creates an identical active copy.
-- We use a session-local GUC set by the RPC; the trigger checks it and skips the duplicate rule.

CREATE OR REPLACE FUNCTION public.job_postings_fingerprint_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_publish timestamptz;
  v_dup_id uuid;
  v_is_publish boolean;
  v_skip_dup boolean;
BEGIN
  NEW.content_fingerprint := public.compute_job_fingerprint(NEW);

  v_is_publish := COALESCE(NEW.is_active, false) = true
                  AND NEW.deleted_at IS NULL
                  AND (
                    TG_OP = 'INSERT'
                    OR COALESCE(OLD.is_active, false) = false
                  );

  IF NOT v_is_publish THEN
    RETURN NEW;
  END IF;

  -- Skip both cooldown and duplicate checks during an explicit republish
  BEGIN
    v_skip_dup := current_setting('parium.skip_fingerprint_guard', true) = 'on';
  EXCEPTION WHEN OTHERS THEN
    v_skip_dup := false;
  END;

  IF v_skip_dup THEN
    RETURN NEW;
  END IF;

  SELECT max(created_at) INTO v_recent_publish
  FROM public.job_postings
  WHERE employer_id = NEW.employer_id
    AND is_active = true
    AND deleted_at IS NULL
    AND (TG_OP = 'INSERT' OR id <> NEW.id)
    AND created_at > (now() - interval '20 seconds');

  IF v_recent_publish IS NOT NULL THEN
    RAISE EXCEPTION 'PARIUM_PUBLISH_COOLDOWN: Vänta några sekunder innan du publicerar nästa annons.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_dup_id
  FROM public.job_postings
  WHERE employer_id = NEW.employer_id
    AND is_active = true
    AND deleted_at IS NULL
    AND content_fingerprint = NEW.content_fingerprint
    AND (TG_OP = 'INSERT' OR id <> NEW.id)
  LIMIT 1;

  IF v_dup_id IS NOT NULL THEN
    RAISE EXCEPTION 'PARIUM_DUPLICATE_JOB: Du har redan en aktiv annons med identiskt innehåll. Ändra något (t.ex. tid, dag, lön eller några ord i beskrivningen) innan du publicerar igen.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.republish_job(_job_id uuid, _days int DEFAULT 30)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _days IS NULL OR _days < 1 THEN _days := 30; END IF;
  IF _days > 365 THEN _days := 365; END IF;

  -- Explicit republish: bypass duplicate/cooldown guard (session-local)
  PERFORM set_config('parium.skip_fingerprint_guard', 'on', true);

  INSERT INTO public.job_postings (
    employer_id, title, description, requirements, location, occupation,
    employment_type, work_schedule, salary_min, salary_max, is_active,
    views_count, applications_count, expires_at, job_image_url,
    salary_transparency, work_start_time, work_end_time, benefits,
    salary_type, positions_count, work_location_type, remote_work_possible,
    workplace_name, workplace_address, workplace_postal_code, workplace_city,
    workplace_county, workplace_municipality, contact_email, application_instructions,
    pitch, category, job_image_desktop_url, image_focus_position, job_image_card_url,
    image_focus_position_desktop, image_focus_position_card, company_logo_url,
    overlay_text_color, image_updated_at, part_time_days, duration_amount,
    duration_unit, part_time_shifts, start_date
  )
  SELECT
    employer_id, title, description, requirements, location, occupation,
    employment_type, work_schedule, salary_min, salary_max, true,
    0, 0, now() + make_interval(days => _days), job_image_url,
    salary_transparency, work_start_time, work_end_time, benefits,
    salary_type, positions_count, work_location_type, remote_work_possible,
    workplace_name, workplace_address, workplace_postal_code, workplace_city,
    workplace_county, workplace_municipality, contact_email, application_instructions,
    pitch, category, job_image_desktop_url, image_focus_position, job_image_card_url,
    image_focus_position_desktop, image_focus_position_card, company_logo_url,
    overlay_text_color, image_updated_at, part_time_days, duration_amount,
    duration_unit, part_time_shifts, start_date
  FROM public.job_postings
  WHERE id = _job_id
    AND employer_id = _uid
    AND deleted_at IS NULL
  RETURNING id INTO _new_id;

  -- Reset flag so it never leaks to other statements in the same session
  PERFORM set_config('parium.skip_fingerprint_guard', 'off', true);

  IF _new_id IS NULL THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  INSERT INTO public.job_questions (
    job_id, question_text, question_type, options, is_required,
    order_index, min_value, max_value, placeholder_text, description
  )
  SELECT _new_id, question_text, question_type, options, is_required,
         order_index, min_value, max_value, placeholder_text, description
  FROM public.job_questions
  WHERE job_id = _job_id;

  INSERT INTO public.job_criteria (
    job_id, employer_id, title, prompt, order_index, is_active
  )
  SELECT _new_id, employer_id, title, prompt, order_index, is_active
  FROM public.job_criteria
  WHERE job_id = _job_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.republish_job(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.republish_job(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.republish_job(uuid, int) TO authenticated;