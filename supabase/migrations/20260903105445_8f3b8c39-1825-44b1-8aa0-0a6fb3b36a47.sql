CREATE OR REPLACE FUNCTION public.republish_job(_job_id uuid, _days integer DEFAULT 14)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new_expires timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _days IS NULL OR _days < 1 THEN _days := 14; END IF;
  IF _days > 365 THEN _days := 365; END IF;

  _new_expires := now() + make_interval(days => _days);

  PERFORM set_config('parium.skip_fingerprint_guard', 'on', true);

  UPDATE public.job_postings jp
  SET
    is_active = true,
    expires_at = _new_expires,
    deleted_at = NULL,
    published_at = COALESCE(jp.published_at, now()),
    -- Legacy rows may contain invalid time strings saved before validation existed.
    -- Normalise them to NULL so republish never fails on the format check constraint.
    work_start_time = CASE
      WHEN jp.work_start_time IS NULL THEN NULL
      WHEN jp.work_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN jp.work_start_time
      ELSE NULL
    END,
    work_end_time = CASE
      WHEN jp.work_end_time IS NULL THEN NULL
      WHEN jp.work_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN jp.work_end_time
      ELSE NULL
    END,
    updated_at = now()
  WHERE jp.id = _job_id
    AND jp.employer_id = _uid;

  PERFORM set_config('parium.skip_fingerprint_guard', 'off', true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or access denied';
  END IF;

  RETURN _job_id;
END;
$function$;