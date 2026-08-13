CREATE OR REPLACE FUNCTION public.fill_application_questions_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.questions_snapshot IS NULL
     OR jsonb_typeof(NEW.questions_snapshot) <> 'array'
     OR jsonb_array_length(NEW.questions_snapshot) = 0 THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_type', q.question_type,
          'options', q.options,
          'is_required', q.is_required,
          'order_index', q.order_index
        ) ORDER BY q.order_index
      ), '[]'::jsonb)
    INTO NEW.questions_snapshot
    FROM public.job_questions q
    WHERE q.job_id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_application_questions_snapshot ON public.job_applications;
CREATE TRIGGER fill_application_questions_snapshot
BEFORE INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.fill_application_questions_snapshot();