
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM user_sessions
  WHERE last_heartbeat_at < now() - interval '20 minutes';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
