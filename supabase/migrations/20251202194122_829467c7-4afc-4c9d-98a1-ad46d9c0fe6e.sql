-- Fix support_messages RLS policy to prevent admin replies from leaking between users
-- The old policy allowed anyone to see admin replies (is_admin_reply = true)
-- The new policy ensures users can only see messages for tickets they own

-- Drop the insecure policy
DROP POLICY IF EXISTS "Users can view their own messages" ON public.support_messages;

-- Create secure policy: users can only view messages for tickets they own
CREATE POLICY "Users can view messages for their own tickets"
ON public.support_messages
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.support_tickets WHERE id = ticket_id
  )
);