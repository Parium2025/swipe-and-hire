CREATE OR REPLACE FUNCTION public.save_owned_job_with_questions(
  p_job_id uuid,
  p_replace_with_new boolean,
  p_job_data jsonb,
  p_questions jsonb
)
RETURNS SETOF public.job_postings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job public.job_postings%ROWTYPE;
  v_original_id uuid;
  v_requested_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'job_save_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_job_data IS NULL OR jsonb_typeof(p_job_data) <> 'object' THEN
    RAISE EXCEPTION 'invalid_job_payload' USING ERRCODE = '22023';
  END IF;

  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'invalid_job_questions_payload' USING ERRCODE = '22023';
  END IF;

  v_original_id := p_job_id;
  v_requested_active := COALESCE((p_job_data->>'is_active')::boolean, false);

  IF p_job_id IS NOT NULL THEN
    SELECT * INTO v_job
    FROM public.job_postings
    WHERE id = p_job_id
      AND employer_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'job_save_not_allowed' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_job_id IS NULL OR p_replace_with_new THEN
    INSERT INTO public.job_postings (employer_id, title, is_active)
    VALUES (auth.uid(), COALESCE(NULLIF(p_job_data->>'title', ''), 'Utkast'), false)
    RETURNING * INTO v_job;
  END IF;

  v_job := jsonb_populate_record(v_job, p_job_data);
  v_job.id := CASE WHEN p_job_id IS NULL OR p_replace_with_new THEN v_job.id ELSE p_job_id END;
  v_job.employer_id := auth.uid();
  v_job.is_active := CASE WHEN p_job_id IS NULL OR p_replace_with_new THEN false ELSE v_requested_active END;

  UPDATE public.job_postings
  SET title = v_job.title,
      description = v_job.description,
      requirements = v_job.requirements,
      location = v_job.location,
      occupation = v_job.occupation,
      employment_type = v_job.employment_type,
      work_schedule = v_job.work_schedule,
      salary_min = v_job.salary_min,
      salary_max = v_job.salary_max,
      is_active = v_job.is_active,
      created_at = v_job.created_at,
      expires_at = v_job.expires_at,
      job_image_url = v_job.job_image_url,
      salary_transparency = v_job.salary_transparency,
      work_start_time = v_job.work_start_time,
      work_end_time = v_job.work_end_time,
      benefits = v_job.benefits,
      salary_type = v_job.salary_type,
      positions_count = v_job.positions_count,
      work_location_type = v_job.work_location_type,
      remote_work_possible = v_job.remote_work_possible,
      workplace_name = v_job.workplace_name,
      workplace_address = v_job.workplace_address,
      workplace_postal_code = v_job.workplace_postal_code,
      workplace_city = v_job.workplace_city,
      workplace_county = v_job.workplace_county,
      workplace_municipality = v_job.workplace_municipality,
      contact_email = v_job.contact_email,
      application_instructions = v_job.application_instructions,
      pitch = v_job.pitch,
      category = v_job.category,
      job_image_desktop_url = v_job.job_image_desktop_url,
      deleted_at = v_job.deleted_at,
      image_focus_position = v_job.image_focus_position,
      image_focus_position_desktop = v_job.image_focus_position_desktop,
      image_focus_position_card = v_job.image_focus_position_card,
      job_image_card_url = v_job.job_image_card_url,
      company_logo_url = v_job.company_logo_url,
      overlay_text_color = v_job.overlay_text_color,
      part_time_days = v_job.part_time_days,
      duration_amount = v_job.duration_amount,
      duration_unit = v_job.duration_unit,
      part_time_shifts = v_job.part_time_shifts,
      start_date = v_job.start_date
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  PERFORM public.sync_owned_job_questions(v_job.id, p_questions);

  IF (p_job_id IS NULL OR p_replace_with_new) AND v_requested_active THEN
    UPDATE public.job_postings
    SET is_active = true
    WHERE id = v_job.id
    RETURNING * INTO v_job;
  END IF;

  IF p_replace_with_new AND v_original_id IS NOT NULL THEN
    UPDATE public.job_postings
    SET deleted_at = now(), is_active = false
    WHERE id = v_original_id
      AND employer_id = auth.uid();
  END IF;

  RETURN NEXT v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.save_owned_job_with_questions(uuid, boolean, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_owned_job_with_questions(uuid, boolean, jsonb, jsonb) TO authenticated, service_role;