ALTER TABLE public.job_postings
ADD COLUMN IF NOT EXISTS company_logo_url text;

UPDATE public.job_postings jp
SET company_logo_url = p.company_logo_url,
    workplace_name = COALESCE(NULLIF(trim(p.company_name), ''), jp.workplace_name),
    updated_at = now()
FROM public.profiles p
WHERE p.user_id = jp.employer_id
  AND jp.deleted_at IS NULL
  AND (
    jp.company_logo_url IS DISTINCT FROM p.company_logo_url
    OR jp.workplace_name IS DISTINCT FROM COALESCE(NULLIF(trim(p.company_name), ''), jp.workplace_name)
  );

CREATE OR REPLACE FUNCTION public.sync_company_name_to_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (
    NEW.company_name IS DISTINCT FROM OLD.company_name
    OR NEW.company_logo_url IS DISTINCT FROM OLD.company_logo_url
  ) THEN
    UPDATE public.job_postings
    SET workplace_name = CASE
          WHEN NEW.company_name IS NOT NULL AND length(trim(NEW.company_name)) > 0
            THEN NEW.company_name
          ELSE workplace_name
        END,
        company_logo_url = NEW.company_logo_url,
        updated_at = now()
    WHERE employer_id = NEW.user_id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;