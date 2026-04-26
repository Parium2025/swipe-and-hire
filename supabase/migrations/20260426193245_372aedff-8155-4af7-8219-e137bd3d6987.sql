CREATE OR REPLACE FUNCTION public.increment_app_exception_count(_owner_user_id uuid, _fingerprint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.app_exceptions
  SET occurrence_count = occurrence_count + 1,
      last_seen_at = now(),
      updated_at = now()
  WHERE owner_user_id = _owner_user_id
    AND fingerprint = _fingerprint;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_app_exception_count(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_app_exception_count(uuid, text) TO authenticated;