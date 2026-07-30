ALTER TABLE public.account_inactivity_notices
  ADD COLUMN IF NOT EXISTS reminder_30_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_7_sent_at timestamptz;

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS removed_applicants_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_removed_applicants(_job_ids uuid[], _counts integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
BEGIN
  IF _job_ids IS NULL THEN RETURN; END IF;
  FOR i IN 1..array_length(_job_ids, 1) LOOP
    UPDATE public.job_postings
       SET removed_applicants_count = COALESCE(removed_applicants_count, 0) + COALESCE(_counts[i], 1)
     WHERE id = _job_ids[i];
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_removed_applicants(uuid[], integer[]) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_removed_applicants(uuid[], integer[]) TO service_role;