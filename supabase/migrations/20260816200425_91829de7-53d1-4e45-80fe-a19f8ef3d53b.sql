DROP TRIGGER IF EXISTS trg_job_postings_fingerprint_guard ON public.job_postings;

CREATE TRIGGER trg_job_postings_fingerprint_guard
BEFORE INSERT OR UPDATE ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.job_postings_fingerprint_guard();

-- Repair any rows changed while the trigger was missing.
UPDATE public.job_postings
SET content_fingerprint = public.compute_job_fingerprint(job_postings.*)
WHERE content_fingerprint IS DISTINCT FROM public.compute_job_fingerprint(job_postings.*);