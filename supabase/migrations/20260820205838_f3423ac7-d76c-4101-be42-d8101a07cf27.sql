-- 1) Mute per medlem
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS muted_at timestamptz;

-- 2) Notistriggern respekterar mute
CREATE OR REPLACE FUNCTION public.notify_conversation_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT cm.user_id
    FROM public.conversation_members cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id
      AND cm.muted_at IS NULL
  LOOP
    IF COALESCE((
      SELECT in_app_enabled FROM public.notification_preferences
      WHERE user_id = r.user_id AND notification_type = 'new_message'
    ), true) THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        r.user_id,
        'new_message',
        'Nytt meddelande',
        LEFT(COALESCE(NULLIF(TRIM(NEW.content), ''), 'Du har fått ett nytt meddelande'), 140),
        jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 3) När sista medlemmen lämnar: radera allt innehåll
CREATE OR REPLACE FUNCTION public.purge_empty_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = OLD.conversation_id
  ) THEN
    DELETE FROM public.conversation_messages WHERE conversation_id = OLD.conversation_id;
    DELETE FROM public.conversations WHERE id = OLD.conversation_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_empty_conversation ON public.conversation_members;
CREATE TRIGGER trg_purge_empty_conversation
AFTER DELETE ON public.conversation_members
FOR EACH ROW EXECUTE FUNCTION public.purge_empty_conversation();

-- 4) Städa notiser som pekar på en raderad konversation
CREATE OR REPLACE FUNCTION public.purge_conversation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE type = 'new_message'
    AND metadata->>'conversation_id' = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_conversation_notifications ON public.conversations;
CREATE TRIGGER trg_purge_conversation_notifications
BEFORE DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.purge_conversation_notifications();