DO $migration$
DECLARE
  source text;
  updated text;
BEGIN
  SELECT prosrc INTO source
  FROM pg_proc
  WHERE oid = 'public.get_employer_analytics_v2(uuid,integer)'::regprocedure;

  updated := replace(source,
    '''is_active'', COALESCE(js.is_active, false)',
    '''is_active'', (js.is_active AND (js.expires_at IS NULL OR js.expires_at >= now()))');
  updated := replace(updated,
    E'      jp.is_active,\n      jp.created_at,',
    E'      jp.is_active,\n      jp.expires_at,\n      jp.created_at,');

  IF updated = source
    OR position('''is_active'', COALESCE(js.is_active, false)' in updated) > 0
    OR position(E'      jp.is_active,\n      jp.expires_at,\n      jp.created_at,' in updated) = 0 THEN
    RAISE EXCEPTION 'Unexpected analytics function definition; refusing partial patch';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_employer_analytics_v2(p_user_id uuid, p_days_back integer DEFAULT NULL::integer) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS %L',
    updated
  );
END $migration$;