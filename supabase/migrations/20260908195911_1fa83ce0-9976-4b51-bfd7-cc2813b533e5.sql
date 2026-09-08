REVOKE ALL ON FUNCTION public.notify_conversation_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_on_conversation_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_conversation_new_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.push_on_conversation_message() TO service_role;