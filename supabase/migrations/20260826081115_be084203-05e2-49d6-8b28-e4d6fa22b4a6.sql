CREATE OR REPLACE FUNCTION public.normalize_verified_job_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_postal text;
  v_city text;
BEGIN
  IF NEW.workplace_postal_code IS NULL OR btrim(NEW.workplace_postal_code) = '' THEN
    NEW.workplace_postal_code := NULL;
    NEW.workplace_city := NULL;
    NEW.workplace_municipality := NULL;
    NEW.workplace_county := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.workplace_postal_code IS NOT DISTINCT FROM OLD.workplace_postal_code
     AND NEW.workplace_city IS NOT DISTINCT FROM OLD.workplace_city THEN
    RETURN NEW;
  END IF;

  v_postal := regexp_replace(NEW.workplace_postal_code, '[^0-9]', '', 'g');
  IF length(v_postal) <> 5 THEN
    RAISE EXCEPTION 'invalid_swedish_postal_code' USING ERRCODE = '23514';
  END IF;

  SELECT city INTO v_city
  FROM public.swedish_postal_codes
  WHERE postal_code = v_postal;

  IF v_city IS NULL THEN
    RAISE EXCEPTION 'unknown_swedish_postal_code' USING ERRCODE = '23514';
  END IF;

  IF NEW.workplace_city IS NOT NULL
     AND btrim(NEW.workplace_city) <> ''
     AND lower(btrim(NEW.workplace_city)) <> lower(v_city) THEN
    RAISE EXCEPTION 'postal_code_city_mismatch' USING ERRCODE = '23514';
  END IF;

  NEW.workplace_postal_code := substr(v_postal, 1, 3) || ' ' || substr(v_postal, 4, 2);
  NEW.workplace_city := v_city;
  NEW.location := v_city;
  NEW.workplace_municipality := NULL;
  NEW.workplace_county := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_verified_job_location() FROM PUBLIC, anon, authenticated;