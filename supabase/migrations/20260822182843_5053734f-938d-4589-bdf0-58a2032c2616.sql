CREATE INDEX IF NOT EXISTS idx_job_applications_phone_digits
  ON public.job_applications ((regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_job_applications_email_trgm
  ON public.job_applications USING gin (lower(coalesce(email,'')) gin_trgm_ops);

DO $do$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src
  FROM pg_proc WHERE proname = 'search_employer_candidates' LIMIT 1;

  -- 1) Ny variabel för siffernormaliserat telefonnummer
  src := replace(src,
    '  v_use_cursor boolean;',
    '  v_use_cursor boolean;' || chr(10) || '  v_digits text;');

  -- 2) Beräkna sifferformen av söksträngen (hanterar +46 → 0)
  src := replace(src,
    '  END IF;' || chr(10) || chr(10) || '  RETURN QUERY',
    '    v_digits := nullif(regexp_replace(v_search, ''[^0-9]'', '''', ''g''), '''');' || chr(10) ||
    '    IF v_digits IS NOT NULL AND left(v_digits, 2) = ''46'' AND length(v_digits) >= 9 THEN' || chr(10) ||
    '      v_digits := ''0'' || substr(v_digits, 3);' || chr(10) ||
    '    END IF;' || chr(10) ||
    '    IF v_digits IS NOT NULL AND length(v_digits) < 4 THEN v_digits := NULL; END IF;' || chr(10) ||
    '  END IF;' || chr(10) || chr(10) || '  RETURN QUERY');

  -- 3) Matcha telefonnummer oavsett mellanslag/bindestreck/landskod, samt e-post
  src := replace(src,
    '        OR EXISTS (' || chr(10) || '          SELECT 1 FROM public.profile_cv_summaries cs',
    '        OR (' || chr(10) ||
    '          v_digits IS NOT NULL' || chr(10) ||
    '          AND regexp_replace(coalesce(a.phone,''''), ''[^0-9]'', '''', ''g'') LIKE ''%'' || v_digits || ''%''' || chr(10) ||
    '        )' || chr(10) ||
    '        OR lower(coalesce(a.email,'''')) LIKE ''%'' || lower(v_search) || ''%''' || chr(10) ||
    '        OR EXISTS (' || chr(10) || '          SELECT 1 FROM public.profile_cv_summaries cs');

  EXECUTE src;
END
$do$;