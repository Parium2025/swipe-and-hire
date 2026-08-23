DO $$
DECLARE d text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), 'jp.deleted_at IS NULL', 'jp.deleted_at IS NULL AND (jp.expires_at IS NULL OR jp.expires_at > now())')
  INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'count_search_jobs';
  EXECUTE d;

  SELECT replace(pg_get_functiondef(p.oid), 'jp.deleted_at IS NULL', 'jp.deleted_at IS NULL AND (jp.expires_at IS NULL OR jp.expires_at > now())')
  INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'search_jobs';
  EXECUTE d;
END $$;