
-- ============================================================================
-- Härdning av RPC-ytan.
--
-- Postgres ger som standard EXECUTE till PUBLIC på alla nya funktioner. Det gör
-- att varje SECURITY DEFINER-funktion i public-schemat blir anropbar av
-- oinloggade (anon) via PostgREST. Flera av dem är rent interna, t.ex.
-- read_email_batch (läser köade auth-mejl med inloggningslänkar) och
-- verify_cron_secret. De låses nu till service_role.
--
-- Funktioner som används i RLS-uttryck måste behålla EXECUTE för anon, annars
-- kastar policyn "permission denied" i stället för att returnera false. De
-- undantas automatiskt nedan.
-- ============================================================================

DO $$
DECLARE
  r record;
  -- Måste fungera utan inloggning (publika sidor)
  public_ok text[] := ARRAY[
    'search_jobs', 'count_search_jobs',
    'get_employer_public_profile', 'get_employer_public_profiles',
    'try_uuid', 'record_job_view',
    'record_app_exception', 'increment_app_exception_count'
  ];
  -- Rent interna: endast serverkod (edge functions / cron) får köra
  service_only text[] := ARRAY[
    'read_email_batch', 'delete_email', 'enqueue_email', 'move_to_dlq',
    'email_queue_dispatch', 'verify_cron_secret',
    'get_cv_queue_batch', 'complete_cv_analysis',
    'dispatch_interview_push', 'cleanup_stale_sessions',
    'increment_removed_applicants', 'get_news_cron_health',
    'trigger_hr_news_fetch', 'trigger_career_tips_fetch',
    'trigger_news_health_watchdog'
  ];
  used_in_policy boolean;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND d.objid IS NULL
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_policies pol
      WHERE pol.schemaname = 'public'
        AND (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, ''))
            ILIKE '%' || r.proname || '(%'
    ) INTO used_in_policy;

    IF r.proname = ANY(service_only) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);

    ELSIF r.proname = ANY(public_ok) OR used_in_policy THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);

    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;

-- Nya funktioner ska inte automatiskt bli anropbara av oinloggade.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
