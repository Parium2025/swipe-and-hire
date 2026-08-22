DO $$
DECLARE r record;
BEGIN
  -- 1) Trigger-funktioner: ska aldrig kunna anropas direkt via API
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;

  -- 2) Arbetsgivar-/kontospecifika funktioner: kräver inloggning
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname IN (
        'search_employer_candidates','search_my_candidates',
        'set_my_candidate_default_list','set_stage_setting_default_list',
        'ensure_default_candidate_list','purge_old_outreach_logs'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;