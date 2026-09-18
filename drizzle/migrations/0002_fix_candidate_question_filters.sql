CREATE OR REPLACE FUNCTION public.application_matches_question_filters(
  p_custom_answers jsonb,
  p_questions_snapshot jsonb,
  p_filters jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) AS filter_item
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(p_questions_snapshot, '[]'::jsonb)) AS snapshot_question
      CROSS JOIN LATERAL (
        SELECT coalesce(
          coalesce(p_custom_answers, '{}'::jsonb) ->> (snapshot_question->>'id'),
          coalesce(p_custom_answers, '{}'::jsonb) ->> (filter_item->>'question')
        ) AS stored_answer
      ) AS resolved
      WHERE lower(btrim(snapshot_question->>'question_text')) = lower(btrim(filter_item->>'question'))
        AND nullif(btrim(resolved.stored_answer), '') IS NOT NULL
        AND (
          jsonb_array_length(coalesce(filter_item->'answers', '[]'::jsonb)) = 0
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(filter_item->'answers') AS selected(answer)
            CROSS JOIN LATERAL regexp_split_to_table(resolved.stored_answer, '\s*\|\|\|\s*') AS stored(value)
            WHERE (
              CASE lower(btrim(stored.value))
                WHEN 'yes' THEN 'ja'
                WHEN 'true' THEN 'ja'
                WHEN 'no' THEN 'nej'
                WHEN 'false' THEN 'nej'
                ELSE lower(btrim(stored.value))
              END
            ) = (
              CASE lower(btrim(selected.answer))
                WHEN 'yes' THEN 'ja'
                WHEN 'true' THEN 'ja'
                WHEN 'no' THEN 'nej'
                WHEN 'false' THEN 'nej'
                ELSE lower(btrim(selected.answer))
              END
            )
          )
        )
    )
  )
$function$;

REVOKE ALL ON FUNCTION public.application_matches_question_filters(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.application_matches_question_filters(jsonb, jsonb, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_employer_candidates(
  p_search text DEFAULT NULL::text,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT NULL::text,
  p_sort text DEFAULT 'applied_at'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_with_count boolean DEFAULT true,
  p_cursor_applied_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid,
  p_count_cap integer DEFAULT 10000
)
RETURNS TABLE(
  id uuid, job_id uuid, applicant_id uuid, first_name text, last_name text,
  email text, phone text, location text, bio text, cv_url text, age integer,
  employment_status text, work_schedule text, availability text,
  custom_answers jsonb, questions_snapshot jsonb, status text,
  applied_at timestamp with time zone, updated_at timestamp with time zone,
  viewed_at timestamp with time zone, job_title text, job_occupation text,
  rating integer, total_count bigint, match_source text, account_deleted boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_filters jsonb := coalesce(p_filters, '[]'::jsonb);
  v_sort text := coalesce(p_sort, 'applied_at');
  v_limit integer := least(coalesce(p_limit, 25), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_with_count boolean := coalesce(p_with_count, true);
  v_cap integer := greatest(coalesce(p_count_cap, 10000), 100);
  v_org uuid;
  v_tsquery text;
  v_norm text;
  v_tokens text[];
  v_use_cursor boolean;
  v_digits text;
  v_ans_tokens text[];
  v_ans_prefilter boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_use_cursor := (v_sort IN ('applied_at','oldest')) AND p_cursor_applied_at IS NOT NULL AND p_cursor_id IS NOT NULL;

  SELECT ur.organization_id INTO v_org
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid AND ur.is_active = true AND ur.organization_id IS NOT NULL
  LIMIT 1;

  IF v_search IS NOT NULL THEN
    SELECT string_agg(t || ':*', ' & ')
    INTO v_tsquery
    FROM regexp_split_to_table(regexp_replace(lower(v_search), '[^a-z0-9åäöéèü ]', ' ', 'g'), '\s+') AS t
    WHERE btrim(t) <> '';

    v_norm := public.parium_norm(v_search);
    SELECT array_agg(t) INTO v_tokens
    FROM regexp_split_to_table(v_norm, '\s+') AS t
    WHERE btrim(t) <> '';
    v_digits := nullif(regexp_replace(v_search, '[^0-9]', '', 'g'), '');
    IF v_digits IS NOT NULL AND left(v_digits, 2) = '46' AND length(v_digits) >= 9 THEN
      v_digits := '0' || substr(v_digits, 3);
    END IF;
    IF v_digits IS NOT NULL AND length(v_digits) < 4 THEN v_digits := NULL; END IF;
  END IF;

  RETURN QUERY
  WITH my_jobs AS (
    SELECT j.id, j.title, j.occupation
    FROM public.job_postings j
    WHERE j.employer_id = v_uid
       OR (
          v_org IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = j.employer_id
              AND ur.is_active = true
              AND ur.organization_id = v_org
          )
       )
  ),
  base AS (
    SELECT DISTINCT ON (csi.applicant_id)
      ja.id, ja.job_id, ja.applicant_id, ja.first_name, ja.last_name, ja.email, ja.phone,
      ja.location, ja.bio, ja.cv_url, ja.age, ja.employment_status, ja.work_schedule,
      ja.availability, ja.custom_answers, ja.questions_snapshot, ja.status,
      ja.applied_at, ja.updated_at, ja.viewed_at,
      j.title AS job_title, j.occupation AS job_occupation,
      CASE
        WHEN v_norm IS NULL THEN 0::real
        ELSE greatest(
          similarity(public.parium_norm(coalesce(ja.first_name,'') || ' ' || coalesce(ja.last_name,'')), v_norm),
          similarity(public.parium_norm(coalesce(ja.last_name,'') || ' ' || coalesce(ja.first_name,'')), v_norm)
        )
      END AS name_score,
      CASE
        WHEN v_search IS NULL THEN NULL::text
        WHEN (v_tsquery IS NOT NULL AND csi.profile_vector @@ to_tsquery('simple', v_tsquery))
          OR public.parium_norm(coalesce(ja.first_name,'') || ' ' || coalesce(ja.last_name,'')) % v_norm
          OR public.parium_norm(coalesce(ja.last_name,'') || ' ' || coalesce(ja.first_name,'')) % v_norm
          THEN 'profile'
        WHEN (v_tsquery IS NOT NULL AND csi.cv_vector @@ to_tsquery('simple', v_tsquery))
          THEN 'cv'
        WHEN EXISTS (
          SELECT 1 FROM public.candidate_notes cn
          WHERE cn.applicant_id = ja.applicant_id
            AND lower(cn.note) LIKE '%' || lower(v_search) || '%'
            AND (
              cn.employer_id = v_uid
              OR (v_org IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.user_roles ur2
                WHERE ur2.user_id = cn.employer_id AND ur2.is_active = true AND ur2.organization_id = v_org
              ))
            )
        ) THEN 'note'
        WHEN (v_tsquery IS NOT NULL AND csi.answers_vector @@ to_tsquery('simple', v_tsquery))
          THEN 'answer'
        ELSE 'profile'
      END AS match_source,
      NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ja.applicant_id) AS account_deleted
    FROM public.candidate_search_index csi
    JOIN public.job_applications ja ON ja.id = csi.application_id
    JOIN my_jobs j ON j.id = csi.job_id
    WHERE
      (p_status IS NULL OR csi.status::text = p_status)
      AND (NOT v_use_cursor OR
        CASE WHEN v_sort = 'oldest'
          THEN (csi.applied_at, csi.application_id) > (p_cursor_applied_at, p_cursor_id)
          ELSE (csi.applied_at, csi.application_id) < (p_cursor_applied_at, p_cursor_id)
        END)
      AND (
        v_search IS NULL
        OR (v_tsquery IS NOT NULL AND csi.search_vector @@ to_tsquery('simple', v_tsquery))
        OR public.parium_norm(coalesce(ja.first_name,'') || ' ' || coalesce(ja.last_name,'')) % v_norm
        OR public.parium_norm(coalesce(ja.last_name,'') || ' ' || coalesce(ja.first_name,'')) % v_norm
        OR (v_digits IS NOT NULL AND csi.phone_digits LIKE '%' || v_digits || '%')
        OR EXISTS (
          SELECT 1 FROM public.candidate_notes cn
          WHERE cn.applicant_id = ja.applicant_id
            AND lower(cn.note) LIKE '%' || lower(v_search) || '%'
            AND (
              cn.employer_id = v_uid
              OR (v_org IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.user_roles ur2
                WHERE ur2.user_id = cn.employer_id AND ur2.is_active = true AND ur2.organization_id = v_org
              ))
            )
        )
      )
      AND public.application_matches_question_filters(
        ja.custom_answers,
        ja.questions_snapshot,
        v_filters
      )
    ORDER BY csi.applicant_id, csi.applied_at DESC
  ),
  filtered AS (
    SELECT b.* FROM base b
  ),
  counted AS (
    SELECT (SELECT count(*) FROM filtered) AS total
  )
  SELECT
    f.id, f.job_id, f.applicant_id, f.first_name, f.last_name, f.email, f.phone,
    f.location, f.bio, f.cv_url, f.age, f.employment_status, f.work_schedule,
    f.availability, f.custom_answers, f.questions_snapshot, f.status,
    f.applied_at, f.updated_at, f.viewed_at, f.job_title, f.job_occupation,
    NULL::integer AS rating,
    CASE WHEN v_with_count THEN least((SELECT total FROM counted), v_cap) ELSE 0 END AS total_count,
    f.match_source,
    f.account_deleted
  FROM filtered f
  ORDER BY
    CASE WHEN v_sort = 'rating' THEN 0 END,
    CASE WHEN v_sort = 'name' THEN lower(f.first_name || ' ' || f.last_name) END,
    CASE WHEN v_sort = 'oldest' THEN f.applied_at END ASC,
    CASE WHEN v_sort <> 'oldest' THEN f.applied_at END DESC,
    f.id DESC
  LIMIT v_limit OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer, boolean, timestamp with time zone, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer, boolean, timestamp with time zone, uuid, integer) TO authenticated, service_role;
