
CREATE OR REPLACE FUNCTION public.get_application_quota(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium boolean;
  v_used int;
  v_limit int := 3;
  v_oldest timestamptz;
  v_reset_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', v_limit, 'is_premium', false, 'reset_at', null);
  END IF;

  v_is_premium := public.has_premium(p_user_id);

  SELECT COUNT(*)::int, MIN(applied_at)
  INTO v_used, v_oldest
  FROM public.job_applications
  WHERE applicant_id = p_user_id
    AND applied_at > now() - interval '7 days';

  IF v_oldest IS NOT NULL THEN
    v_reset_at := v_oldest + interval '7 days';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_is_premium OR v_used < v_limit,
    'used', COALESCE(v_used, 0),
    'limit', v_limit,
    'is_premium', v_is_premium,
    'reset_at', v_reset_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_application_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_application_quota(uuid) TO authenticated, service_role;
