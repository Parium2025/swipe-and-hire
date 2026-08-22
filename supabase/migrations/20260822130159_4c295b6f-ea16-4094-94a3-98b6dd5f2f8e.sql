REVOKE ALL ON FUNCTION public.enforce_conversation_block() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_blocked_pair(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(uuid, uuid) TO service_role;