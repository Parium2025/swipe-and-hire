-- PAUSAD: gratisplanens ansökningskvot är tillfälligt avstängd inför lansering.
-- Återaktivera genom att återställa v_paused till false.
CREATE OR REPLACE FUNCTION public.enforce_application_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paused constant boolean := true;
  v_is_premium boolean;
  v_used int;
  v_limit constant int := 3;
BEGIN
  IF v_paused THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.applicant_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  v_is_premium := public.has_premium(NEW.applicant_id);
  IF v_is_premium THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
  INTO v_used
  FROM public.job_applications
  WHERE applicant_id = NEW.applicant_id
    AND applied_at > now() - interval '7 days';

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'application_quota_exceeded'
      USING HINT = 'Free tier is limited to 3 applications per 7 days. Upgrade to premium.',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Rapportera obegränsad kvot till klienten så att UI:t inte visar spärrar.
CREATE OR REPLACE FUNCTION public.get_application_quota(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*)::int INTO v_used
  FROM public.job_applications
  WHERE applicant_id = p_user_id
    AND applied_at > now() - interval '7 days';

  -- Kvoten är pausad: alla behandlas som premium med obegränsat antal ansökningar.
  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'limit', 2147483647,
    'is_premium', true,
    'reset_at', null
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_application_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_application_quota(uuid) TO authenticated;