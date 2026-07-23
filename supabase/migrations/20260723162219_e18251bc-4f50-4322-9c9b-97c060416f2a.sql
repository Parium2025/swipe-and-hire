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

  -- Hide the previous expired original so it disappears from "Utgångna"
  UPDATE public.job_postings
  SET deleted_at = now(),
      is_active = false
  WHERE id = _job_id
    AND employer_id = _uid
    AND deleted_at IS NULL;

  RETURN _new_id;
END;
$$;