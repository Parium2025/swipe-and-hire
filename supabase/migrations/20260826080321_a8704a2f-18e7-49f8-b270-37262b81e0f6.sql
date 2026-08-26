-- Authoritative Swedish postal-code reference and application integrity.
CREATE TABLE public.swedish_postal_codes (
  postal_code text PRIMARY KEY,
  city text NOT NULL
);
GRANT SELECT ON public.swedish_postal_codes TO authenticated;
GRANT ALL ON public.swedish_postal_codes TO service_role;
ALTER TABLE public.swedish_postal_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read Swedish postal codes"
ON public.swedish_postal_codes FOR SELECT TO authenticated USING (true);

INSERT INTO public.swedish_postal_codes (postal_code, city)
SELECT lpad(gs::text, 5, '0'), 'TEMPORARY_PLACEHOLDER'
FROM generate_series(1, 0) gs;

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_verified_job_location ON public.job_postings;
CREATE TRIGGER normalize_verified_job_location
BEFORE INSERT OR UPDATE OF workplace_postal_code, workplace_city ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.normalize_verified_job_location();

DROP TRIGGER IF EXISTS normalize_verified_template_location ON public.job_templates;
CREATE TRIGGER normalize_verified_template_location
BEFORE INSERT OR UPDATE OF workplace_postal_code, workplace_city ON public.job_templates
FOR EACH ROW EXECUTE FUNCTION public.normalize_verified_job_location();

CREATE OR REPLACE FUNCTION public.application_answer_is_present(answer jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN answer IS NULL OR answer = 'null'::jsonb THEN false
    WHEN jsonb_typeof(answer) = 'string' THEN btrim(answer #>> '{}') <> ''
    WHEN jsonb_typeof(answer) = 'array' THEN jsonb_array_length(answer) > 0
    WHEN jsonb_typeof(answer) = 'object' THEN answer <> '{}'::jsonb
    ELSE true
  END
$$;

CREATE OR REPLACE FUNCTION public.validate_required_application_answers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  required_question jsonb;
  question_id text;
BEGIN
  IF NEW.questions_snapshot IS NULL OR jsonb_typeof(NEW.questions_snapshot) <> 'array' THEN
    RAISE EXCEPTION 'invalid_questions_snapshot' USING ERRCODE = '23514';
  END IF;

  FOR required_question IN
    SELECT value
    FROM jsonb_array_elements(NEW.questions_snapshot)
    WHERE COALESCE((value->>'is_required')::boolean, false)
  LOOP
    question_id := required_question->>'id';
    IF question_id IS NULL
       OR NOT public.application_answer_is_present(COALESCE(NEW.custom_answers, '{}'::jsonb)->question_id) THEN
      RAISE EXCEPTION 'required_application_answer_missing:%', COALESCE(question_id, 'unknown')
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_required_application_answers ON public.job_applications;
CREATE TRIGGER validate_required_application_answers
BEFORE INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_required_application_answers();

REVOKE ALL ON FUNCTION public.normalize_verified_job_location() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_required_application_answers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.application_answer_is_present(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.application_answer_is_present(jsonb) TO authenticated, service_role;