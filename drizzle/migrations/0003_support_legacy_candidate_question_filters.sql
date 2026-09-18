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
    WHERE NOT (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(p_questions_snapshot, '[]'::jsonb)) AS snapshot_question
        CROSS JOIN LATERAL (
          SELECT coalesce(p_custom_answers, '{}'::jsonb) ->> (snapshot_question->>'id') AS stored_answer
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
      OR (
        nullif(btrim(coalesce(p_custom_answers, '{}'::jsonb) ->> (filter_item->>'question')), '') IS NOT NULL
        AND (
          jsonb_array_length(coalesce(filter_item->'answers', '[]'::jsonb)) = 0
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(filter_item->'answers') AS selected(answer)
            CROSS JOIN LATERAL regexp_split_to_table(
              coalesce(p_custom_answers, '{}'::jsonb) ->> (filter_item->>'question'),
              '\s*\|\|\|\s*'
            ) AS stored(value)
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
  )
$function$;

REVOKE ALL ON FUNCTION public.application_matches_question_filters(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.application_matches_question_filters(jsonb, jsonb, jsonb) TO authenticated, service_role;