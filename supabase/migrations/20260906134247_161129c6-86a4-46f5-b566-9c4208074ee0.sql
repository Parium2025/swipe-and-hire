CREATE OR REPLACE FUNCTION public.parium_answer_tokens(_answers jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(array_agg(DISTINCT t.tok), ARRAY[]::text[])
  FROM (
    SELECT lower(btrim(kv.k)) || '=' || lower(btrim(kv.v)) AS tok
    FROM jsonb_each_text(coalesce(_answers, '{}'::jsonb)) AS kv(k, v)
    WHERE coalesce(btrim(kv.v), '') <> ''
    UNION ALL
    SELECT lower(btrim(kv.k)) || '=' || CASE lower(btrim(kv.v)) WHEN 'true' THEN 'ja' ELSE 'nej' END
    FROM jsonb_each_text(coalesce(_answers, '{}'::jsonb)) AS kv(k, v)
    WHERE lower(btrim(kv.v)) IN ('true', 'false')
  ) t
$$;

CREATE INDEX IF NOT EXISTS idx_job_applications_answer_tokens
  ON public.job_applications
  USING gin (public.parium_answer_tokens(custom_answers));

DO $do$
DECLARE
  src text;
  before_len int;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src
  FROM pg_proc
  WHERE proname = 'search_employer_candidates'
    AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF src IS NULL THEN
    RAISE EXCEPTION 'search_employer_candidates not found';
  END IF;

  IF position('v_ans_tokens' in src) > 0 THEN
    RETURN; -- redan patchad
  END IF;

  -- 1) nya variabler
  before_len := length(src);
  src := replace(
    src,
    '  v_digits text;',
    '  v_digits text;' || E'\n' ||
    '  v_ans_tokens text[];' || E'\n' ||
    '  v_ans_prefilter boolean := false;'
  );
  IF length(src) = before_len THEN
    RAISE EXCEPTION 'anchor v_digits not found';
  END IF;

  -- 2) beräkna token-listan innan huvudfrågan
  before_len := length(src);
  src := replace(
    src,
    '  RETURN QUERY',
    '  IF jsonb_array_length(v_filters) > 0 THEN' || E'\n' ||
    '    SELECT bool_and(jsonb_array_length(coalesce(f->''answers'', ''[]''::jsonb)) > 0)' || E'\n' ||
    '      INTO v_ans_prefilter' || E'\n' ||
    '      FROM jsonb_array_elements(v_filters) AS f;' || E'\n' ||
    '    IF coalesce(v_ans_prefilter, false) THEN' || E'\n' ||
    '      SELECT array_agg(DISTINCT lower(btrim(f->>''question'')) || ''='' || lower(btrim(ans)))' || E'\n' ||
    '        INTO v_ans_tokens' || E'\n' ||
    '        FROM jsonb_array_elements(v_filters) AS f,' || E'\n' ||
    '             jsonb_array_elements_text(f->''answers'') AS ans;' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    v_ans_prefilter := coalesce(v_ans_prefilter, false) AND v_ans_tokens IS NOT NULL;' || E'\n' ||
    '  END IF;' || E'\n\n' ||
    '  RETURN QUERY'
  );
  IF length(src) = before_len THEN
    RAISE EXCEPTION 'anchor RETURN QUERY not found';
  END IF;

  -- 3) indexvänligt förfilter före det exakta villkoret
  before_len := length(src);
  src := replace(
    src,
    '      AND (' || E'\n' ||
    '        jsonb_array_length(v_filters) = 0' || E'\n' ||
    '        OR NOT EXISTS (',
    '      AND (' || E'\n' ||
    '        NOT v_ans_prefilter' || E'\n' ||
    '        OR public.parium_answer_tokens(a.custom_answers) && v_ans_tokens' || E'\n' ||
    '      )' || E'\n' ||
    '      AND (' || E'\n' ||
    '        jsonb_array_length(v_filters) = 0' || E'\n' ||
    '        OR NOT EXISTS ('
  );
  IF length(src) = before_len THEN
    RAISE EXCEPTION 'anchor filter block not found';
  END IF;

  EXECUTE src;
END
$do$;