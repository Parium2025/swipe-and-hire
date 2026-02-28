
-- Atomic batch reorder for job stage settings
-- Accepts a job_id and an array of stage_keys in the desired order
CREATE OR REPLACE FUNCTION public.reorder_job_stages(p_job_id uuid, p_stage_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  i int;
BEGIN
  -- Verify the caller owns this job (directly or via org)
  IF NOT can_view_job_application(p_job_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update all order_index values in a single transaction
  FOR i IN 1..array_length(p_stage_keys, 1) LOOP
    UPDATE job_stage_settings
    SET order_index = i - 1,
        updated_at = now()
    WHERE job_id = p_job_id
      AND stage_key = p_stage_keys[i];
  END LOOP;
END;
$$;
