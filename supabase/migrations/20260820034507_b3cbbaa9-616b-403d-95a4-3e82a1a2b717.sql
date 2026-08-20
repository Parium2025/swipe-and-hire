-- Backfill drifted application counters
UPDATE public.job_postings jp
SET applications_count = sub.actual
FROM (
  SELECT j.id, COUNT(a.id)::int AS actual
  FROM public.job_postings j
  LEFT JOIN public.job_applications a ON a.job_id = j.id
  GROUP BY j.id
) sub
WHERE jp.id = sub.id
  AND COALESCE(jp.applications_count, 0) IS DISTINCT FROM sub.actual;

-- Make the counter self-healing on delete (recount instead of blind -1)
CREATE OR REPLACE FUNCTION public.decrement_job_applications_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE job_postings jp
  SET applications_count = (
    SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = OLD.job_id
  )
  WHERE jp.id = OLD.job_id;
  RETURN OLD;
END;
$$;