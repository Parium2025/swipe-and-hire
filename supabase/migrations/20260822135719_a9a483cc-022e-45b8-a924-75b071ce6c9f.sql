CREATE OR REPLACE FUNCTION public.prevent_membership_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'Cannot change membership identity';
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_conversation_admin(OLD.conversation_id) OR auth.uid() = OLD.user_id THEN
      RAISE EXCEPTION 'Only conversation admins can change admin status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_membership_escalation ON public.conversation_members;
CREATE TRIGGER trg_prevent_membership_escalation
BEFORE UPDATE ON public.conversation_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_membership_escalation();

DROP POLICY IF EXISTS "Members can update their own membership" ON public.conversation_members;
CREATE POLICY "Members can update their own membership"
ON public.conversation_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime DROP TABLE public.user_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions (id, user_id, session_token, revoked_at);