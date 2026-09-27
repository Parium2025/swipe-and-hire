CREATE OR REPLACE FUNCTION public.remove_session(p_session_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_sessions
  SET revoked_at = now(),
      last_heartbeat_at = now()
  WHERE session_token = p_session_token
    AND user_id = auth.uid()
    AND revoked_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_session(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_session(text) TO authenticated, service_role;