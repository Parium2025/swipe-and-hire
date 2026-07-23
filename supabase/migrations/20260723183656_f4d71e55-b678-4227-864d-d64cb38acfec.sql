CREATE OR REPLACE FUNCTION public.purge_soft_deleted_jobs()
RETURNS TABLE(purged_job_id uuid, image_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '90 days';
  ids uuid[];
BEGIN
  -- 1. Hämta IDs som är soft-deletade > 90 dagar OCH som inte längre
  --    refereras av någon jobbsökares sparade jobb eller ansökan.
  --    Så länge en jobbsökare har annonsen kvar i "Sparade" eller "Mina ansökningar"
  --    lever raden vidare — den försvinner först när jobbsökaren själv tar bort den.
  SELECT array_agg(jp.id) INTO ids
  FROM public.job_postings jp
  WHERE jp.deleted_at IS NOT NULL
    AND jp.deleted_at < cutoff
    AND NOT EXISTS (SELECT 1 FROM public.saved_jobs sj WHERE sj.job_id = jp.id)
    AND NOT EXISTS (SELECT 1 FROM public.job_applications ja WHERE ja.job_id = jp.id);

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 2. Nolla FK-referenser utan CASCADE
  UPDATE public.one_time_purchases     SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.candidate_ratings      SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.conversations          SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.outreach_dispatch_logs SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.profile_views          SET job_id = NULL WHERE job_id = ANY(ids);

  -- 3. Hard-delete
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM public.job_postings
    WHERE id = ANY(ids)
    RETURNING id, job_image_url
  )
  SELECT id, job_image_url FROM deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_soft_deleted_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_jobs() TO service_role;