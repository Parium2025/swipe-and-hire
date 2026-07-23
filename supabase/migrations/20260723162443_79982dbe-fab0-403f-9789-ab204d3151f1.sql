-- Backfill: hide expired originals that already have an active republished copy
UPDATE public.job_postings AS old
SET deleted_at = now(),
    is_active = false
WHERE old.deleted_at IS NULL
  AND (old.is_active = false OR old.expires_at < now())
  AND EXISTS (
    SELECT 1 FROM public.job_postings AS newer
    WHERE newer.employer_id = old.employer_id
      AND newer.deleted_at IS NULL
      AND newer.is_active = true
      AND newer.content_fingerprint = old.content_fingerprint
      AND newer.created_at > old.created_at
  );