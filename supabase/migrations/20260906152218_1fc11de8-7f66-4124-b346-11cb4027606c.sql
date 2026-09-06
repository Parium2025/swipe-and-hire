DO $$
DECLARE
  p RECORD;
  new_qual TEXT;
  new_check TEXT;
  stmt TEXT;
  n INT := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ~ '(?<!select )auth\.(uid|jwt|role)\(\)'
        OR with_check ~ '(?<!select )auth\.(uid|jwt|role)\(\)')
  LOOP
    new_qual := regexp_replace(p.qual, '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    new_check := regexp_replace(p.with_check, '(?<!select )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Optimerade % policies', n;
END $$;