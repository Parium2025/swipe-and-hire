CREATE OR REPLACE FUNCTION public.guard_conversation_members_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_service_role() THEN RETURN NEW; END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change conversation_id or user_id';
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = OLD.conversation_id AND user_id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'Only conversation admins can change admin status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;