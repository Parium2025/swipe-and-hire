
-- 1. Trim trailing/leading spaces in profiles.company_name (root cause of sync skips)
UPDATE public.profiles
SET company_name = trim(company_name)
WHERE company_name IS NOT NULL
  AND company_name <> trim(company_name);

-- 2. Trim trailing/leading spaces in job_postings.workplace_name
UPDATE public.job_postings
SET workplace_name = trim(workplace_name)
WHERE workplace_name IS NOT NULL
  AND workplace_name <> trim(workplace_name);

-- 3. Recreate sync trigger function: always trim, always sync if branding differs
CREATE OR REPLACE FUNCTION public.sync_company_name_to_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_name text;
  v_old_name text;
BEGIN
  v_new_name := NULLIF(trim(COALESCE(NEW.company_name, '')), '');
  v_old_name := NULLIF(trim(COALESCE(OLD.company_name, '')), '');

  IF (
    v_new_name IS DISTINCT FROM v_old_name
    OR NEW.company_logo_url IS DISTINCT FROM OLD.company_logo_url
  ) THEN
    UPDATE public.job_postings
    SET workplace_name = CASE
          WHEN v_new_name IS NOT NULL
            THEN v_new_name
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

-- 4. One-time hard resync: force every active job to match its employer's profile
UPDATE public.job_postings jp
SET workplace_name = NULLIF(trim(COALESCE(p.company_name, '')), ''),
    company_logo_url = p.company_logo_url,
    updated_at = now()
FROM public.profiles p
WHERE jp.employer_id = p.user_id
  AND jp.deleted_at IS NULL
  AND p.company_name IS NOT NULL
  AND trim(p.company_name) <> ''
  AND (
    jp.workplace_name IS DISTINCT FROM NULLIF(trim(p.company_name), '')
    OR jp.company_logo_url IS DISTINCT FROM p.company_logo_url
  );
