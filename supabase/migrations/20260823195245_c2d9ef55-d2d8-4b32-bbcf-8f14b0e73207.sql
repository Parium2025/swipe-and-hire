REVOKE EXECUTE ON FUNCTION public.claim_criteria_eval_run(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_criteria_eval_items(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_criteria_eval_item(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pause_criteria_eval_run(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_criteria_eval_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_criteria_eval_run(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_criteria_eval_run(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_criteria_eval_run(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_criteria_eval_items(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_criteria_eval_item(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pause_criteria_eval_run(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_criteria_eval_run(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_criteria_eval_run(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_criteria_eval_run(uuid) TO authenticated, service_role;