DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'search_employer_candidates' AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'search_employer_candidates not found';
  END IF;

  IF position('WHERE p.id = s.applicant_id' in v_def) = 0 THEN
    RAISE NOTICE 'already fixed';
    RETURN;
  END IF;

  v_def := replace(v_def, 'WHERE p.id = s.applicant_id', 'WHERE p.user_id = s.applicant_id');
  EXECUTE v_def;
END $$;