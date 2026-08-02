DROP POLICY IF EXISTS "Users can insert own system-alert notifications" ON public.notifications;

CREATE OR REPLACE FUNCTION public.create_system_performance_alert(
  _title text,
  _body text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (auth.uid(), 'system_performance_alert', _title, _body, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_system_performance_alert(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_system_performance_alert(text, text, jsonb) TO authenticated;