CREATE OR REPLACE FUNCTION public.get_profile_view_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unique_30d int;
  v_total int;
  v_last_viewed timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('unique_viewers_30d', 0, 'total_views', 0, 'last_viewed_at', null);
  END IF;

  -- En enda genomsökning av indexet (viewed_user_id, viewed_at DESC)
  -- i stället för två separata.
  SELECT
    COUNT(DISTINCT viewer_user_id) FILTER (WHERE viewed_at > now() - interval '30 days')::int,
    COUNT(*)::int,
    MAX(viewed_at)
    INTO v_unique_30d, v_total, v_last_viewed
  FROM public.profile_views
  WHERE viewed_user_id = p_user_id;

  RETURN jsonb_build_object(
    'unique_viewers_30d', COALESCE(v_unique_30d, 0),
    'total_views', COALESCE(v_total, 0),
    'last_viewed_at', v_last_viewed
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_profile_view_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_view_stats(uuid) TO authenticated, service_role;