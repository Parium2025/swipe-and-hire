-- ============================================================
-- Unified, pre-computed candidate search index
--
-- Goal: every searchable token for a job application is computed
-- once (at application time / when CV summary / note is saved)
-- and stored in a single row. Employer search then becomes one
-- indexed scan instead of multiple OR-subqueries across several
-- tables. This is what makes search feel instant even with
-- hundreds of thousands of applicants per employer.
-- ============================================================

-- 1. Create the index table
CREATE TABLE IF NOT EXISTS public.candidate_search_index (
  application_id UUID PRIMARY KEY REFERENCES public.job_applications(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  employer_id UUID NOT NULL,
  organization_id UUID,
  status TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Full-text vectors (separate vectors let us preserve match_source)
  search_vector TSVECTOR,
  profile_vector TSVECTOR,
  cv_vector TSVECTOR,
  answers_vector TSVECTOR,

  -- Normalised plain text for trigram/ILIKE fallback
  search_text TEXT,

  -- Raw source text kept for snippets/debugging
  raw_text TEXT,
  summary_text TEXT,
  notes_text TEXT,

  -- Pre-computed answer tokens for question-filter prefiltering
  answer_tokens TEXT[],

  -- Normalised phone digits for phone-number search
  phone_digits TEXT,

  -- Mirrors the application's soft-delete / account-deleted state
  account_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Required grants (Supabase Data API does not grant public-schema privileges by default)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_search_index TO authenticated;
GRANT ALL ON public.candidate_search_index TO service_role;

ALTER TABLE public.candidate_search_index ENABLE ROW LEVEL SECURITY;

-- Direct client access is not needed; the search RPC uses SECURITY DEFINER.
CREATE POLICY "Service role manages search index"
ON public.candidate_search_index FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "No direct user access to search index"
ON public.candidate_search_index FOR ALL
TO authenticated
USING (false);

-- 2. Indexes for fast employer search
CREATE INDEX IF NOT EXISTS idx_candidate_search_index_search_vector
  ON public.candidate_search_index USING gin (search_vector);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_profile_vector
  ON public.candidate_search_index USING gin (profile_vector);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_cv_vector
  ON public.candidate_search_index USING gin (cv_vector);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_answers_vector
  ON public.candidate_search_index USING gin (answers_vector);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_search_text_trgm
  ON public.candidate_search_index USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_answer_tokens
  ON public.candidate_search_index USING gin (answer_tokens);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_job_applied
  ON public.candidate_search_index (job_id, applied_at DESC, application_id DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_employer
  ON public.candidate_search_index (employer_id);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_applicant
  ON public.candidate_search_index (applicant_id);

CREATE INDEX IF NOT EXISTS idx_candidate_search_index_phone_digits
  ON public.candidate_search_index (phone_digits)
  WHERE phone_digits IS NOT NULL;

-- 3. Helper: refresh a single index row from source tables
CREATE OR REPLACE FUNCTION public.refresh_candidate_search_index(_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app public.job_applications%ROWTYPE;
  v_job public.job_postings%ROWTYPE;
  v_summary public.candidate_summaries%ROWTYPE;
  v_profile_summary public.profile_cv_summaries%ROWTYPE;
  v_cv_text text;
  v_summary_text text;
  v_notes_text text;
  v_answers_text text;
  v_profile_vector tsvector;
  v_cv_vector tsvector;
  v_answers_vector tsvector;
  v_search_vector tsvector;
  v_search_text text;
  v_answer_tokens text[];
  v_phone_digits text;
  v_org_id uuid;
BEGIN
  SELECT * INTO v_app FROM public.job_applications WHERE id = _application_id;
  IF NOT FOUND THEN
    DELETE FROM public.candidate_search_index WHERE application_id = _application_id;
    RETURN;
  END IF;

  SELECT * INTO v_job FROM public.job_postings WHERE id = v_app.job_id;
  IF NOT FOUND THEN
    DELETE FROM public.candidate_search_index WHERE application_id = _application_id;
    RETURN;
  END IF;

  -- Employer organisation (used for note visibility and org-scoped filtering)
  SELECT organization_id INTO v_org_id
  FROM public.user_roles
  WHERE user_id = v_job.employer_id AND is_active = true AND organization_id IS NOT NULL
  LIMIT 1;

  -- CV summary: prefer job-specific, fall back to proactive profile summary
  SELECT * INTO v_summary FROM public.candidate_summaries
  WHERE job_id = v_app.job_id AND applicant_id = v_app.applicant_id
  LIMIT 1;

  IF v_summary.id IS NULL OR coalesce(v_summary.summary_text, '') = '' THEN
    SELECT * INTO v_profile_summary FROM public.profile_cv_summaries WHERE user_id = v_app.applicant_id;
    IF v_profile_summary.id IS NOT NULL THEN
      v_cv_text := v_profile_summary.raw_text;
      v_summary_text := v_profile_summary.summary_text;
    END IF;
  ELSE
    v_cv_text := v_summary.raw_text;
    v_summary_text := v_summary.summary_text;
  END IF;

  -- Aggregate notes visible to this employer / organisation
  SELECT string_agg(cn.note, ' ' ORDER BY cn.updated_at DESC) INTO v_notes_text
  FROM public.candidate_notes cn
  WHERE cn.applicant_id = v_app.applicant_id
    AND (
      cn.employer_id = v_job.employer_id
      OR (v_org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = cn.employer_id AND ur.is_active = true AND ur.organization_id = v_org_id
      ))
    );

  -- Answer text
  IF v_app.custom_answers IS NOT NULL THEN
    SELECT string_agg(value::text, ' ') INTO v_answers_text
    FROM jsonb_each_text(v_app.custom_answers::jsonb);
  END IF;

  -- Normalise phone digits the same way the search function expects
  v_phone_digits := nullif(regexp_replace(coalesce(v_app.phone,''), '[^0-9]', '', 'g'), '');
  IF v_phone_digits IS NOT NULL AND left(v_phone_digits, 2) = '46' AND length(v_phone_digits) >= 9 THEN
    v_phone_digits := '0' || substr(v_phone_digits, 3);
  END IF;
  IF v_phone_digits IS NOT NULL AND length(v_phone_digits) < 4 THEN v_phone_digits := NULL; END IF;

  -- Build full-text vectors
  v_profile_vector :=
    setweight(to_tsvector('simple', coalesce(v_app.first_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_app.last_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(v_app.email, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(v_app.phone, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(v_app.location, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(v_app.bio, '')), 'C');

  v_cv_vector :=
    setweight(to_tsvector('simple', coalesce(v_cv_text, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(v_summary_text, '')), 'C');

  v_answers_vector :=
    setweight(to_tsvector('simple', coalesce(v_answers_text, '')), 'D');

  v_search_vector := v_profile_vector || v_cv_vector || v_answers_vector ||
    setweight(to_tsvector('simple', coalesce(v_notes_text, '')), 'C');

  -- Normalised plain-text mirror for trigram/ILIKE fallback
  v_search_text := public.parium_norm(
    coalesce(v_app.first_name, '') || ' ' ||
    coalesce(v_app.last_name, '') || ' ' ||
    coalesce(v_app.email, '') || ' ' ||
    coalesce(v_app.phone, '') || ' ' ||
    coalesce(v_app.location, '') || ' ' ||
    coalesce(v_app.bio, '') || ' ' ||
    coalesce(v_cv_text, '') || ' ' ||
    coalesce(v_summary_text, '') || ' ' ||
    coalesce(v_notes_text, '') || ' ' ||
    coalesce(v_answers_text, '')
  );

  -- Pre-computed answer tokens for the question-filter fast path
  v_answer_tokens := public.parium_answer_tokens(v_app.custom_answers);

  -- Upsert the index row
  INSERT INTO public.candidate_search_index (
    application_id, job_id, applicant_id, employer_id, organization_id,
    status, applied_at, updated_at,
    search_vector, profile_vector, cv_vector, answers_vector,
    search_text, raw_text, summary_text, notes_text, answer_tokens,
    phone_digits, account_deleted
  ) VALUES (
    v_app.id, v_app.job_id, v_app.applicant_id, v_job.employer_id, v_org_id,
    v_app.status, v_app.applied_at, v_app.updated_at,
    v_search_vector, v_profile_vector, v_cv_vector, v_answers_vector,
    v_search_text, v_cv_text, v_summary_text, v_notes_text, v_answer_tokens,
    v_phone_digits, false
  )
  ON CONFLICT (application_id) DO UPDATE SET
    job_id = EXCLUDED.job_id,
    applicant_id = EXCLUDED.applicant_id,
    employer_id = EXCLUDED.employer_id,
    organization_id = EXCLUDED.organization_id,
    status = EXCLUDED.status,
    applied_at = EXCLUDED.applied_at,
    updated_at = EXCLUDED.updated_at,
    search_vector = EXCLUDED.search_vector,
    profile_vector = EXCLUDED.profile_vector,
    cv_vector = EXCLUDED.cv_vector,
    answers_vector = EXCLUDED.answers_vector,
    search_text = EXCLUDED.search_text,
    raw_text = EXCLUDED.raw_text,
    summary_text = EXCLUDED.summary_text,
    notes_text = EXCLUDED.notes_text,
    answer_tokens = EXCLUDED.answer_tokens,
    phone_digits = EXCLUDED.phone_digits,
    account_deleted = EXCLUDED.account_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_candidate_search_index(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_candidate_search_index(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_candidate_search_index(uuid) TO service_role;

-- 4. Trigger: keep index in sync when an application changes
CREATE OR REPLACE FUNCTION public.trigger_refresh_candidate_search_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.refresh_candidate_search_index(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_applications_search_index_trigger ON public.job_applications;
CREATE TRIGGER job_applications_search_index_trigger
  AFTER INSERT OR UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_candidate_search_index();

-- 5. Trigger: keep index in sync when a job-specific CV summary is saved
CREATE OR REPLACE FUNCTION public.trigger_refresh_candidate_search_index_from_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app_id uuid;
BEGIN
  SELECT id INTO v_app_id FROM public.job_applications
  WHERE job_id = NEW.job_id AND applicant_id = NEW.applicant_id
  LIMIT 1;

  IF v_app_id IS NOT NULL THEN
    PERFORM public.refresh_candidate_search_index(v_app_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidate_summaries_search_index_trigger ON public.candidate_summaries;
CREATE TRIGGER candidate_summaries_search_index_trigger
  AFTER INSERT OR UPDATE ON public.candidate_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_candidate_search_index_from_summary();

-- 6. Trigger: keep index in sync when a proactive profile CV summary is saved
CREATE OR REPLACE FUNCTION public.trigger_refresh_candidate_search_index_from_profile_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app_id uuid;
BEGIN
  FOR v_app_id IN
    SELECT id FROM public.job_applications WHERE applicant_id = NEW.user_id
  LOOP
    PERFORM public.refresh_candidate_search_index(v_app_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_cv_summaries_search_index_trigger ON public.profile_cv_summaries;
CREATE TRIGGER profile_cv_summaries_search_index_trigger
  AFTER INSERT OR UPDATE ON public.profile_cv_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_candidate_search_index_from_profile_summary();

-- 7. Trigger: keep index in sync when candidate notes change
CREATE OR REPLACE FUNCTION public.trigger_refresh_candidate_search_index_from_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app_id uuid;
  v_employer_id uuid;
  v_org_id uuid;
  v_applicant_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_employer_id := OLD.employer_id;
    v_applicant_id := OLD.applicant_id;
  ELSE
    v_employer_id := NEW.employer_id;
    v_applicant_id := NEW.applicant_id;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.user_roles
  WHERE user_id = v_employer_id AND is_active = true AND organization_id IS NOT NULL
  LIMIT 1;

  FOR v_app_id IN
    SELECT ja.id
    FROM public.job_applications ja
    JOIN public.job_postings jp ON jp.id = ja.job_id
    WHERE ja.applicant_id = v_applicant_id
      AND (
        jp.employer_id = v_employer_id
        OR (v_org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = jp.employer_id AND ur.is_active = true AND ur.organization_id = v_org_id
        ))
      )
  LOOP
    PERFORM public.refresh_candidate_search_index(v_app_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS candidate_notes_search_index_trigger ON public.candidate_notes;
CREATE TRIGGER candidate_notes_search_index_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_candidate_search_index_from_notes();

-- 8. Backfill existing applications
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.candidate_search_index;
  IF v_count = 0 THEN
    PERFORM public.refresh_candidate_search_index(a.id)
    FROM public.job_applications a;
  END IF;
END $$;

-- 9. Rewrite employer search to use the pre-computed index
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

  IF jsonb_array_length(v_filters) > 0 THEN
    SELECT bool_and(jsonb_array_length(coalesce(f->'answers', '[]'::jsonb)) > 0)
      INTO v_ans_prefilter
      FROM jsonb_array_elements(v_filters) AS f;
    IF coalesce(v_ans_prefilter, false) THEN
      SELECT array_agg(DISTINCT lower(btrim(f->>'question')) || '=' || lower(btrim(ans)))
        INTO v_ans_tokens
        FROM jsonb_array_elements(v_filters) AS f,
             jsonb_array_elements_text(f->'answers') AS ans;
    END IF;
    v_ans_prefilter := coalesce(v_ans_prefilter, false) AND v_ans_tokens IS NOT NULL;
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
      AND (
        NOT v_ans_prefilter
        OR csi.answer_tokens @> v_ans_tokens
      )
    ORDER BY csi.applicant_id, csi.applied_at DESC
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE
      jsonb_array_length(v_filters) = 0
      OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_filters) f
        WHERE jsonb_array_length(coalesce(f->'answers','[]'::jsonb)) > 0
          AND NOT (
            coalesce(b.custom_answers, '{}'::jsonb) ->> (f->>'question') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(f->'answers') ans
              WHERE lower(coalesce(b.custom_answers, '{}'::jsonb) ->> (f->>'question')) LIKE '%' || lower(ans) || '%'
            )
          )
      )
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
GRANT EXECUTE ON FUNCTION public.search_employer_candidates(text, jsonb, text, text, integer, integer, boolean, timestamp with time zone, uuid, integer) TO authenticated;
