-- 1) Synonymordlista för yrken/branschtermer (svensk rekryteringsvokabulär)
CREATE OR REPLACE FUNCTION public.parium_synonyms(_tok text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _tok IN ('utvecklare','programmerare','systemutvecklare','kodare','devalop','developer')
      THEN ARRAY['utvecklare','programmerare','systemutvecklare','developer','kodare']
    WHEN _tok IN ('chauffor','forare','lastbilschauffor','yrkeschauffor','truckforare','driver')
      THEN ARRAY['chauffor','forare','lastbilschauffor','yrkeschauffor','driver']
    WHEN _tok IN ('ck','ckort','ce','cekort','lastbilskort','yrkesforarkompetens','ykb')
      THEN ARRAY['c-kort','ckort','ce-kort','cekort','lastbilskort','ykb','yrkeskompetensbevis']
    WHEN _tok IN ('bkort','korkort','bilkort')
      THEN ARRAY['b-kort','bkort','korkort']
    WHEN _tok IN ('lagerarbetare','lagermedarbetare','lager','plockare','terminalarbetare')
      THEN ARRAY['lagerarbetare','lagermedarbetare','lager','plockare','terminalarbetare']
    WHEN _tok IN ('saljare','forsaljare','account','kundansvarig','salesrep','sales')
      THEN ARRAY['saljare','forsaljare','account','kundansvarig','sales']
    WHEN _tok IN ('skoterska','sjukskoterska','ssk','undersskoterska','underskoterska','usk','vardbitrade')
      THEN ARRAY['skoterska','sjukskoterska','ssk','underskoterska','usk','vardbitrade']
    WHEN _tok IN ('elektriker','elmontor','installationselektriker','servicetekniker')
      THEN ARRAY['elektriker','elmontor','installationselektriker','servicetekniker']
    WHEN _tok IN ('snickare','byggnadsarbetare','byggare','timmerman')
      THEN ARRAY['snickare','byggnadsarbetare','byggare','timmerman']
    WHEN _tok IN ('kock','kallskanka','koksbitrade','restaurangbitrade')
      THEN ARRAY['kock','kallskanka','koksbitrade','restaurangbitrade']
    WHEN _tok IN ('stadare','lokalvardare','stad','lokalvard')
      THEN ARRAY['stadare','lokalvardare','stad','lokalvard']
    WHEN _tok IN ('ekonom','redovisningsekonom','bokforare','controller','revisor')
      THEN ARRAY['ekonom','redovisningsekonom','bokforare','controller','revisor']
    WHEN _tok IN ('larare','pedagog','forskollarare','fritidspedagog')
      THEN ARRAY['larare','pedagog','forskollarare','fritidspedagog']
    WHEN _tok IN ('sthlm','stockholm','sto')
      THEN ARRAY['stockholm','sthlm']
    WHEN _tok IN ('gbg','goteborg','gothenburg')
      THEN ARRAY['goteborg','gbg','gothenburg']
    WHEN _tok IN ('mmo','malmo')
      THEN ARRAY['malmo','mmo']
    WHEN _tok IN ('heltid','fulltid','fulltime')
      THEN ARRAY['heltid','fulltid']
    WHEN _tok IN ('deltid','parttime')
      THEN ARRAY['deltid']
    WHEN _tok IN ('truckkort','truck','a1','a2','a4','b1')
      THEN ARRAY['truckkort','truck']
    ELSE ARRAY[_tok]
  END;
$$;

REVOKE ALL ON FUNCTION public.parium_synonyms(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parium_synonyms(text) TO authenticated, service_role;

-- 2) Index för fritextsökning i frågesvar
CREATE INDEX IF NOT EXISTS idx_job_applications_answers_trgm
  ON public.job_applications USING gin (lower(coalesce(custom_answers, '{}'::jsonb)::text) gin_trgm_ops);

-- 3) Utöka sökfunktionen: synonymer + fritext i frågesvar + ny träffkälla
DO $do$
DECLARE
  src text;
  haystack text := 'coalesce(a.first_name,'''') || '' '' || coalesce(a.last_name,'''') || '' '' || coalesce(a.email,'''') || '' '' || coalesce(a.phone,'''') || '' '' || coalesce(a.location,'''') || '' '' || coalesce(j.title,'''') || '' '' || coalesce(j.occupation,'''')';
  fuzzy text := 'coalesce(a.first_name,'''') || '' '' || coalesce(a.last_name,'''') || '' '' || coalesce(a.location,'''') || '' '' || coalesce(j.title,'''')';
  old_tok text;
  new_tok text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src
  FROM pg_proc WHERE proname = 'search_employer_candidates' LIMIT 1;

  old_tok :=
    '            SELECT 1 FROM unnest(v_tokens) AS tok' || chr(10) ||
    '            WHERE NOT (' || chr(10) ||
    '              public.parium_norm(' || chr(10) ||
    '                coalesce(a.first_name,'''') || '' '' || coalesce(a.last_name,'''') || '' '' ||' || chr(10) ||
    '                coalesce(a.email,'''') || '' '' || coalesce(a.phone,'''') || '' '' ||' || chr(10) ||
    '                coalesce(a.location,'''') || '' '' || coalesce(j.title,'''') || '' '' ||' || chr(10) ||
    '                coalesce(j.occupation,'''')' || chr(10) ||
    '              ) LIKE ''%'' || tok || ''%''' || chr(10) ||
    '              OR (' || chr(10) ||
    '                length(tok) >= 4' || chr(10) ||
    '                AND word_similarity(tok, public.parium_norm(' || chr(10) ||
    '                  coalesce(a.first_name,'''') || '' '' || coalesce(a.last_name,'''') || '' '' ||' || chr(10) ||
    '                  coalesce(a.location,'''') || '' '' || coalesce(j.title,'''')' || chr(10) ||
    '                )) >= 0.45' || chr(10) ||
    '              )' || chr(10) ||
    '            )';

  IF position(old_tok in src) = 0 THEN
    RAISE EXCEPTION 'Token-blocket hittades inte — avbryter utan ändring';
  END IF;

  new_tok :=
    '            SELECT 1 FROM unnest(v_tokens) AS tok' || chr(10) ||
    '            WHERE NOT EXISTS (' || chr(10) ||
    '              SELECT 1 FROM unnest(public.parium_synonyms(tok)) AS syn' || chr(10) ||
    '              WHERE public.parium_norm(' || haystack || ') LIKE ''%'' || public.parium_norm(syn) || ''%''' || chr(10) ||
    '                 OR lower(coalesce(a.custom_answers, ''{}''::jsonb)::text) LIKE ''%'' || lower(syn) || ''%''' || chr(10) ||
    '                 OR (' || chr(10) ||
    '                   length(syn) >= 4' || chr(10) ||
    '                   AND word_similarity(public.parium_norm(syn), public.parium_norm(' || fuzzy || ')) >= 0.45' || chr(10) ||
    '                 )' || chr(10) ||
    '            )';

  src := replace(src, old_tok, new_tok);

  -- Fritextträff i frågesvar som egen sökväg + etikett
  src := replace(src,
    '        ) THEN ''note''' || chr(10) || '        ELSE ''profile''',
    '        ) THEN ''note''' || chr(10) ||
    '        WHEN lower(coalesce(a.custom_answers, ''{}''::jsonb)::text) LIKE ''%'' || lower(v_search) || ''%''' || chr(10) ||
    '          THEN ''answer''' || chr(10) ||
    '        ELSE ''profile''');

  src := replace(src,
    '        OR lower(coalesce(a.email,'''')) LIKE ''%'' || lower(v_search) || ''%''',
    '        OR lower(coalesce(a.email,'''')) LIKE ''%'' || lower(v_search) || ''%''' || chr(10) ||
    '        OR lower(coalesce(a.custom_answers, ''{}''::jsonb)::text) LIKE ''%'' || lower(v_search) || ''%''');

  EXECUTE src;
END
$do$;