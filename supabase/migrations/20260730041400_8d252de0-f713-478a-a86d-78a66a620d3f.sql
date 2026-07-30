CREATE OR REPLACE FUNCTION public.increment_removed_applicants(_job_ids uuid[], _counts integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
  n integer;
BEGIN
  n := COALESCE(array_length(_job_ids, 1), 0);
  IF n = 0 THEN RETURN; END IF;
  FOR i IN 1..n LOOP
    UPDATE public.job_postings
       SET removed_applicants_count = COALESCE(removed_applicants_count, 0) + COALESCE(_counts[i], 1)
     WHERE id = _job_ids[i];
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_removed_applicants(uuid[], integer[]) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_removed_applicants(uuid[], integer[]) TO service_role;