ALTER TABLE public.job_postings
ADD COLUMN IF NOT EXISTS overlay_text_color TEXT NOT NULL DEFAULT '#FFFFFF';

CREATE OR REPLACE FUNCTION public.validate_job_overlay_text_color()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.overlay_text_color IS NULL OR NEW.overlay_text_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    NEW.overlay_text_color := '#FFFFFF';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_job_overlay_text_color_trigger ON public.job_postings;
CREATE TRIGGER validate_job_overlay_text_color_trigger
BEFORE INSERT OR UPDATE ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.validate_job_overlay_text_color();