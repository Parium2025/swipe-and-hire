CREATE OR REPLACE FUNCTION public.get_employer_inbox_stats(p_user_id uuid, p_active_job_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT public.get_employer_dashboard_stats(p_user_id, p_active_job_ids) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_inbox_stats(uuid, uuid[]) TO authenticated;