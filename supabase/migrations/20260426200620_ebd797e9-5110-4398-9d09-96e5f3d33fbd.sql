-- Allow admins/owners to see all captured app exceptions while users still only see their own
DROP POLICY IF EXISTS "Admins can view all app exceptions" ON public.app_exceptions;
CREATE POLICY "Admins can view all app exceptions"
ON public.app_exceptions
FOR SELECT
TO authenticated
USING (public.is_org_admin(auth.uid()));

-- Harden and extend exception recording so owner/admin accounts get internal alerts.
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
  v_admin_id uuid;
  v_alert_body text;
  v_alert_metadata jsonb;
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
    LEFT(COALESCE(NULLIF(_kind, ''), 'runtime_error'), 80),
    CASE WHEN _severity = 'critical' THEN 'critical' ELSE 'warning' END,
    LEFT(COALESCE(NULLIF(_title, ''), 'Appfel upptäckt'), 180),
    LEFT(COALESCE(NULLIF(_message, ''), 'Okänt fel'), 2000),
    LEFT(COALESCE(NULLIF(_route, ''), '/'), 500),
    NULLIF(LEFT(COALESCE(_source, ''), 1000), ''),
    NULLIF(LEFT(COALESCE(_stacktrace, ''), 4000), ''),
    _http_status,
    LEFT(COALESCE(NULLIF(_fingerprint, ''), md5(COALESCE(_message, '') || COALESCE(_route, ''))), 200),
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

  v_alert_body := LEFT(COALESCE(NULLIF(_message, ''), 'Okänt fel') || ' (' || COALESCE(NULLIF(_route, ''), '/') || ')', 900);
  v_alert_metadata := jsonb_build_object(
    'route', COALESCE(NULLIF(_route, ''), '/status'),
    'area', COALESCE(NULLIF(_kind, ''), 'runtime_error'),
    'status', CASE WHEN _severity = 'critical' THEN 'critical' ELSE 'warning' END,
    'source', COALESCE(_source, ''),
    'httpStatus', COALESCE(_http_status::text, ''),
    'fingerprint', COALESCE(NULLIF(_fingerprint, ''), ''),
    'exceptionId', v_id,
    'reporterUserId', _owner_user_id
  );

  FOR v_admin_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND ur.is_active = true
      AND ur.user_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_admin_id
        AND n.type = 'system_app_failure'
        AND n.created_at > now() - interval '15 minutes'
        AND n.metadata->>'fingerprint' = COALESCE(NULLIF(_fingerprint, ''), '')
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        v_admin_id,
        'system_app_failure',
        LEFT(COALESCE(NULLIF(_title, ''), 'Appfel upptäckt'), 180),
        v_alert_body,
        v_alert_metadata
      );

      BEGIN
        PERFORM public.dispatch_interview_push(
          v_admin_id,
          LEFT(COALESCE(NULLIF(_title, ''), 'Appfel upptäckt'), 180),
          v_alert_body,
          v_alert_metadata
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'App exception push alert failed for %: %', v_admin_id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_app_exception(uuid, text, text, text, text, text, text, text, text, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_app_exception(uuid, text, text, text, text, text, text, text, text, integer, text, jsonb) TO authenticated;