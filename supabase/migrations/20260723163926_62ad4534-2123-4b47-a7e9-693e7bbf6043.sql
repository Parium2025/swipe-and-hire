-- 90-dagars retention för soft-deletade jobbannonser
-- När en arbetsgivare tar bort en annons sätts deleted_at = now().
-- Efter 90 dagar hard-deletas raden + relaterat data via cron.

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_jobs()
RETURNS TABLE(purged_job_id uuid, image_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '90 days';
BEGIN
  -- Returnera bild-URL:er så edge-function kan städa storage,
  -- sedan hard-delete raden (cascades tar hand om beroenden).
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM public.job_postings
    WHERE deleted_at IS NOT NULL
      AND deleted_at < cutoff
    RETURNING id, job_image_url
  )
  SELECT id, job_image_url FROM deleted;
END;
$$;

-- Endast service_role får köra (anropas från edge function via cron)
REVOKE EXECUTE ON FUNCTION public.purge_soft_deleted_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_jobs() TO service_role;

COMMENT ON FUNCTION public.purge_soft_deleted_jobs() IS
  'GDPR retention: hard-deletes job_postings soft-deleted more than 90 days ago. Returns rows so caller can purge storage. Called nightly by cron via edge function purge-deleted-jobs.';