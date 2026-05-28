-- 1. Lägg till kolumnen, backfill från updated_at
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS image_updated_at timestamp with time zone;

UPDATE public.job_postings
SET image_updated_at = COALESCE(updated_at, created_at, now())
WHERE image_updated_at IS NULL;

ALTER TABLE public.job_postings
  ALTER COLUMN image_updated_at SET DEFAULT now(),
  ALTER COLUMN image_updated_at SET NOT NULL;

-- 2. Trigger-funktion: bumpa endast när bildrelaterade fält ändras
CREATE OR REPLACE FUNCTION public.bump_job_image_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.image_updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.job_image_url IS DISTINCT FROM OLD.job_image_url
     OR NEW.job_image_desktop_url IS DISTINCT FROM OLD.job_image_desktop_url
     OR NEW.job_image_card_url IS DISTINCT FROM OLD.job_image_card_url
     OR NEW.company_logo_url IS DISTINCT FROM OLD.company_logo_url
     OR NEW.image_focus_position IS DISTINCT FROM OLD.image_focus_position
     OR NEW.image_focus_position_desktop IS DISTINCT FROM OLD.image_focus_position_desktop
     OR NEW.image_focus_position_card IS DISTINCT FROM OLD.image_focus_position_card
     OR NEW.overlay_text_color IS DISTINCT FROM OLD.overlay_text_color
  THEN
    NEW.image_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_job_image_updated_at ON public.job_postings;
CREATE TRIGGER trg_bump_job_image_updated_at
BEFORE INSERT OR UPDATE ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.bump_job_image_updated_at();