CREATE OR REPLACE FUNCTION public.delete_candidate_list_safely(p_list_id uuid)
RETURNS TABLE(moved_count integer, fallback_list_id uuid, fallback_name text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_is_default boolean;
  v_fallback_id uuid;
  v_fallback_name text;
  v_target_stage text;
  v_moved integer := 0;
  v_deleted integer := 0;
BEGIN
  SELECT cl.owner_id, cl.is_default
    INTO v_owner_id, v_is_default
  FROM public.candidate_lists cl
  WHERE cl.id = p_list_id
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Listan hittades inte';
  END IF;
  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Du saknar behörighet att ta bort listan';
  END IF;
  IF v_is_default THEN
    RAISE EXCEPTION 'Standardlistan går inte att ta bort';
  END IF;

  SELECT cl.id, cl.name
    INTO v_fallback_id, v_fallback_name
  FROM public.candidate_lists cl
  WHERE cl.owner_id = v_owner_id
    AND cl.is_default
    AND cl.id <> p_list_id
  ORDER BY cl.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_fallback_id IS NULL THEN
    RAISE EXCEPTION 'Standardlistan saknas';
  END IF;

  SELECT uss.stage_key
    INTO v_target_stage
  FROM public.user_stage_settings uss
  WHERE uss.user_id = v_owner_id
    AND uss.list_id = v_fallback_id
    AND uss.order_index > -1
  ORDER BY uss.order_index ASC
  LIMIT 1;
  v_target_stage := COALESCE(v_target_stage, 'to_contact');

  UPDATE public.my_candidates
  SET list_id = v_fallback_id,
      stage = v_target_stage,
      updated_at = now()
  WHERE list_id = p_list_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  DELETE FROM public.candidate_lists
  WHERE id = p_list_id AND owner_id = v_owner_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Listan kunde inte tas bort';
  END IF;

  RETURN QUERY SELECT v_moved, v_fallback_id, v_fallback_name;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_candidate_list_safely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_candidate_list_safely(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_candidate_list_safely(uuid) TO service_role;