DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src FROM pg_proc WHERE proname='search_employer_candidates' LIMIT 1;
  src := replace(src, 'FUNCTION public.search_employer_candidates(', 'FUNCTION public.__tmp_search_check(');
  src := replace(src, 'v_uid uuid := auth.uid();', 'v_uid uuid := ''7efa4356-ded1-4fb4-b771-9c72313459e4''::uuid;');
  EXECUTE src;
END $do$;