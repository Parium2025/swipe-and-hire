ALTER TABLE public.conversation_blocks
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- Tyst spärr: meddelanden sparas, men levereras aldrig till den som blockerat.
DROP TRIGGER IF EXISTS enforce_conversation_block ON public.conversation_messages;
DROP TRIGGER IF EXISTS trg_enforce_conversation_block ON public.conversation_messages;

CREATE OR REPLACE FUNCTION public.notify_conversation_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND NOT EXISTS (
        SELECT 1 FROM public.conversation_blocks cb
        WHERE cb.blocker_id = cm.user_id
          AND cb.blocked_id = NEW.sender_id
          AND cb.released_at IS NULL
      )
  LOOP
    IF COALESCE((
      SELECT in_app_enabled FROM public.notification_preferences
      WHERE user_id = r.user_id AND notification_type = 'new_message'
    ), true) THEN
      INSERT INTO public.notifications (user_id, type, title, body, metadata)
      VALUES (
        r.user_id,
        'new_message',
        'Nytt chattmeddelande',
        LEFT(COALESCE(NULLIF(TRIM(NEW.content), ''), 'Du har fått ett nytt meddelande'), 140),
        jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;