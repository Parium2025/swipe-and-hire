CREATE OR REPLACE FUNCTION public.get_employer_filter_questions()
RETURNS TABLE (
  question_text text,
  question_type text,
  options text[],
  job_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT auth.uid() AS user_id,
           public.get_user_organization_id(auth.uid()) AS organization_id
  ),
  visible_jobs AS (
    SELECT jp.id
    FROM public.job_postings jp
    CROSS JOIN caller c
    WHERE c.user_id IS NOT NULL
      AND (
        jp.employer_id = c.user_id
        OR (
          c.organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = jp.employer_id
              AND ur.organization_id = c.organization_id
              AND ur.is_active = true
          )
        )
      )
  ),
  normalized AS (
    SELECT
      jq.question_text,
      jq.question_type,
      jq.options,
      jq.job_id
    FROM public.job_questions jq
    JOIN visible_jobs vj ON vj.id = jq.job_id
    WHERE nullif(btrim(jq.question_text), '') IS NOT NULL
  ),
  question_groups AS (
    SELECT
      n.question_text,
      (array_agg(n.question_type ORDER BY n.question_type))[1] AS question_type,
      count(DISTINCT n.job_id)::bigint AS job_count
    FROM normalized n
    GROUP BY n.question_text
  ),
  merged_options AS (
    SELECT
      n.question_text,
      array_agg(DISTINCT option_value ORDER BY option_value)
        FILTER (WHERE option_value IS NOT NULL) AS options
    FROM normalized n
    LEFT JOIN LATERAL unnest(coalesce(n.options, ARRAY[]::text[])) option_value ON true
    GROUP BY n.question_text
  )
  SELECT
    qg.question_text,
    qg.question_type,
    coalesce(mo.options, ARRAY[]::text[]) AS options,
    qg.job_count
  FROM question_groups qg
  JOIN merged_options mo USING (question_text)
  ORDER BY qg.job_count DESC, qg.question_text ASC;
$$;

REVOKE ALL ON FUNCTION public.get_employer_filter_questions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employer_filter_questions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_filter_questions() TO service_role;