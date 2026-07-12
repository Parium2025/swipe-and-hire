
CREATE OR REPLACE FUNCTION public.is_email_notification_enabled(
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_enabled boolean;
BEGIN
  IF p_type IS NULL THEN
    RETURN true;
  END IF;

  v_user_id := p_user_id;

  IF v_user_id IS NULL AND p_email IS NOT NULL AND p_email <> '' THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_email)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT email_enabled INTO v_enabled
  FROM public.notification_preferences
  WHERE user_id = v_user_id
    AND notification_type = p_type
  LIMIT 1;

  RETURN COALESCE(v_enabled, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_email_notification_enabled(uuid, text, text) TO authenticated, service_role, anon;
