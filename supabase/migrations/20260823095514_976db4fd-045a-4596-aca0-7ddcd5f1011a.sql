DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_employer_analytics_v2(uuid,integer)'::regprocedure);
  d := replace(d,
    'AND jv.user_id NOT IN (SELECT user_id FROM org_members)',
    'AND (jv.user_id IS NULL OR jv.user_id NOT IN (SELECT user_id FROM org_members))');
  d := replace(d,
    'FROM filtered_views
    GROUP BY device_type',
    'FROM filtered_views
    GROUP BY COALESCE(device_type, ''unknown'')');
  d := replace(d,
    'FROM filtered_views
    GROUP BY os_type',
    'FROM filtered_views
    GROUP BY COALESCE(os_type, ''unknown'')');
  EXECUTE d;
END $do$;