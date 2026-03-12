-- Drop the legacy notify_new_message function and all dependent triggers.
-- This was part of the old 'messages' table system, replaced by conversation_messages.
DROP FUNCTION IF EXISTS public.notify_new_message() CASCADE;