
-- Reparera kort som ligger i borttagna/okända steg så att de blir synliga igen
WITH first_stage AS (
  SELECT DISTINCT ON (user_id, list_id) user_id, list_id, stage_key
  FROM public.user_stage_settings
  WHERE order_index > -1
  ORDER BY user_id, list_id, order_index ASC
),
valid AS (
  SELECT user_id, list_id, stage_key FROM public.user_stage_settings WHERE order_index > -1
)
UPDATE public.my_candidates mc
SET stage = fs.stage_key, updated_at = now()
FROM first_stage fs
WHERE fs.user_id = mc.recruiter_id
  AND fs.list_id IS NOT DISTINCT FROM mc.list_id
  AND NOT EXISTS (
    SELECT 1 FROM valid v
    WHERE v.user_id = mc.recruiter_id
      AND v.list_id IS NOT DISTINCT FROM mc.list_id
      AND v.stage_key = mc.stage
  );
