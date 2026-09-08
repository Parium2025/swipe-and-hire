-- Avslag och "Anställd" kan aldrig gälla samtidigt för samma ansökan.
-- Om en arbetsgivare flyttar en tidigare avslagen kandidat till Anställd
-- rensas avslagsmarkeringen automatiskt (databasen är sanningen, så det
-- gäller oavsett var i appen flytten görs: drag & drop, mobilmeny, bulk).
CREATE OR REPLACE FUNCTION public.clear_rejection_on_hire()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'hired' AND NEW.rejected_at IS NOT NULL THEN
    NEW.rejected_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_rejection_on_hire ON public.job_applications;
CREATE TRIGGER trg_clear_rejection_on_hire
BEFORE UPDATE OF status, rejected_at ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.clear_rejection_on_hire();

-- Städa eventuella befintliga rader som redan är både anställda och avslagsmarkerade.
UPDATE public.job_applications
SET rejected_at = NULL
WHERE status = 'hired' AND rejected_at IS NOT NULL;

REVOKE ALL ON FUNCTION public.clear_rejection_on_hire() FROM PUBLIC, anon, authenticated;