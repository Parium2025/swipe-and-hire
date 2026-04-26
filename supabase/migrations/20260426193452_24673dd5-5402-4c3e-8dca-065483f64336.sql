CREATE OR REPLACE FUNCTION public.record_app_exception(
  _owner_user_id uuid,
  _environment text,
  _kind text,
  _severity text,
  _title text,
  _message text,
  _route text,
  _source text,
  _stacktrace text,
  _http_status integer,
  _fingerprint text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _owner_user_id THEN
    RAISE EXCEPTION 'Not allowed to record exceptions for this owner';
  END IF;

  INSERT INTO public.app_exceptions (
    owner_user_id,
    environment,
    kind,
    severity,
    title,
    message,
    route,
    source,
    stacktrace,
    http_status,
    fingerprint,
    metadata
  ) VALUES (
    _owner_user_id,
    COALESCE(NULLIF(_environment, ''), 'production'),
    _kind,
    _severity,
    _title,
    _message,
    COALESCE(NULLIF(_route, ''), '/'),
    _source,
    _stacktrace,
    _http_status,
    _fingerprint,
    COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (owner_user_id, fingerprint)
  DO UPDATE SET
    severity = EXCLUDED.severity,
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    route = EXCLUDED.route,
    source = EXCLUDED.source,
    stacktrace = EXCLUDED.stacktrace,
    http_status = EXCLUDED.http_status,
    metadata = EXCLUDED.metadata,
    occurrence_count = public.app_exceptions.occurrence_count + 1,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;