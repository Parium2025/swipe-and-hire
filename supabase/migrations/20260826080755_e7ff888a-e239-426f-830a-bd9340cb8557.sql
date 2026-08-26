CREATE OR REPLACE FUNCTION public.sync_owned_job_questions(
  p_job_id uuid,
  p_questions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_question jsonb;
  v_keep_ids uuid[] := ARRAY[]::uuid[];
  v_question_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.job_postings
    WHERE id = p_job_id
      AND employer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'job_question_sync_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'invalid_job_questions_payload' USING ERRCODE = '22023';
  END IF;

  FOR v_question IN SELECT value FROM jsonb_array_elements(p_questions)
  LOOP
    IF btrim(COALESCE(v_question->>'question_text', '')) = '' THEN
      RAISE EXCEPTION 'job_question_text_required' USING ERRCODE = '23514';
    END IF;

    BEGIN
      v_question_id := NULLIF(v_question->>'id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_question_id := NULL;
    END;

    IF v_question_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.job_questions
      WHERE id = v_question_id AND job_id = p_job_id
    ) THEN
      UPDATE public.job_questions
      SET question_text = v_question->>'question_text',
          question_type = v_question->>'question_type',
          options = CASE
            WHEN jsonb_typeof(v_question->'options') = 'array'
              THEN ARRAY(SELECT jsonb_array_elements_text(v_question->'options'))
            ELSE NULL
          END,
          is_required = COALESCE((v_question->>'is_required')::boolean, true),
          order_index = COALESCE((v_question->>'order_index')::integer, 0),
          min_value = NULLIF(v_question->>'min_value', '')::integer,
          max_value = NULLIF(v_question->>'max_value', '')::integer,
          placeholder_text = NULLIF(v_question->>'placeholder_text', '')
      WHERE id = v_question_id;
    ELSE
      INSERT INTO public.job_questions (
        job_id, question_text, question_type, options, is_required,
        order_index, min_value, max_value, placeholder_text
      ) VALUES (
        p_job_id,
        v_question->>'question_text',
        v_question->>'question_type',
        CASE
          WHEN jsonb_typeof(v_question->'options') = 'array'
            THEN ARRAY(SELECT jsonb_array_elements_text(v_question->'options'))
          ELSE NULL
        END,
        COALESCE((v_question->>'is_required')::boolean, true),
        COALESCE((v_question->>'order_index')::integer, 0),
        NULLIF(v_question->>'min_value', '')::integer,
        NULLIF(v_question->>'max_value', '')::integer,
        NULLIF(v_question->>'placeholder_text', '')
      ) RETURNING id INTO v_question_id;
    END IF;

    v_keep_ids := array_append(v_keep_ids, v_question_id);
  END LOOP;

  DELETE FROM public.job_questions
  WHERE job_id = p_job_id
    AND NOT (id = ANY(v_keep_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.sync_owned_job_questions(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_owned_job_questions(uuid, jsonb) TO authenticated, service_role;