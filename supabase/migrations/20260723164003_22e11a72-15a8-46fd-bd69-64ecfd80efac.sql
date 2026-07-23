-- Uppdatera purge-funktionen så den hanterar FK:er utan CASCADE
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
  -- 1. Hämta alla IDs som ska raderas
  SELECT array_agg(id) INTO ids
  FROM public.job_postings
  WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;

  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 2. Nolla FK-referenser som inte har ON DELETE CASCADE (annars blockeras radering)
  UPDATE public.one_time_purchases    SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.candidate_ratings     SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.conversations         SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.outreach_dispatch_logs SET job_id = NULL WHERE job_id = ANY(ids);
  UPDATE public.profile_views         SET job_id = NULL WHERE job_id = ANY(ids);

  -- 3. Hard-delete (kaskaderar till questions, applications, saved_jobs osv.)
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