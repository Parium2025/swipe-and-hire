-- Aktivera realtime endast för tabeller som INTE redan är medlemmar
-- Använder DO-block för att hantera redan existerande tabeller

DO $$
DECLARE
  tables_to_add text[] := ARRAY[
    'interviews',
    'company_reviews', 
    'conversations',
    'conversation_members',
    'user_stage_settings',
    'job_questions',
    'job_stage_settings',
    'candidate_ratings',
    'candidate_activities',
    'candidate_notes',
    'saved_searches'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_to_add
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime', t;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '% already in supabase_realtime, skipping', t;
    END;
  END LOOP;
END $$;