DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proacl IS NOT NULL
      AND array_to_string(p.proacl::text[], ',') LIKE '%=X/%'
      AND EXISTS (SELECT 1 FROM unnest(p.proacl::text[]) a WHERE a LIKE '=X/%')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;
END $$;