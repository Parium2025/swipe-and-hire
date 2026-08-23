CREATE OR REPLACE FUNCTION public.guard_job_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ett utkast (is_active = false) får ALDRIG få published_at satt.
  -- Endast trg_set_job_published_at (vid publicering, is_active = true) sätter det.
  IF NEW.published_at IS NOT NULL
     AND OLD.published_at IS NULL
     AND COALESCE(NEW.is_active, false) IS NOT TRUE THEN
    NEW.published_at := NULL;
  END IF;

  -- En publicerad annons kan inte "avpubliceras" genom att nollställa published_at.
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS NULL THEN
    NEW.published_at := OLD.published_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_job_published_at ON public.job_postings;
CREATE TRIGGER trg_guard_job_published_at
BEFORE UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.guard_job_published_at();