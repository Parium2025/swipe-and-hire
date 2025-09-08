-- Update the validation function to handle storage paths correctly
CREATE OR REPLACE FUNCTION public.validate_profile_data(birth_date date, phone text, cv_url text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN  
  -- Validate birth date (must be at least 16 years old)
  IF birth_date IS NOT NULL AND birth_date > (CURRENT_DATE - INTERVAL '16 years') THEN
    RETURN false;
  END IF;
  
  -- Validate phone number format (Swedish format)
  IF phone IS NOT NULL AND phone !~ '^(\+46|0)[1-9][0-9]{7,9}$' THEN
    RETURN false;
  END IF;
  
  -- Validate CV URL - allow either storage path or full URL with job-applications bucket
  IF cv_url IS NOT NULL AND cv_url != '' AND NOT (
    cv_url LIKE '%/job-applications/%' OR -- Full URL format
    cv_url ~ '^[a-f0-9\-]{36}/[0-9]{13}-[a-z0-9]+\.[a-zA-Z0-9]+$' -- Storage path format (uuid/timestamp-random.ext)
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;