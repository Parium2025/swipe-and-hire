CREATE OR REPLACE FUNCTION public.notify_message_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_msg RECORD;
  v_actor_name text;
  v_muted boolean;
  v_in_app boolean;
  v_push boolean;
BEGIN
  SELECT m.id, m.conversation_id, m.sender_id, m.content, m.is_system_message
  INTO v_msg
  FROM public.conversation_messages m
  WHERE m.id = NEW.message_id;

  IF v_msg.id IS NULL OR v_msg.sender_id IS NULL OR v_msg.sender_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Mottagaren måste fortfarande vara med i chatten och inte ha tystat den
  SELECT (cm.muted_at IS NOT NULL) INTO v_muted
  FROM public.conversation_members cm
  WHERE cm.conversation_id = v_msg.conversation_id
    AND cm.user_id = v_msg.sender_id;

  IF v_muted IS NULL OR v_muted THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversation_blocks cb
    WHERE cb.blocker_id = v_msg.sender_id
      AND cb.blocked_id = NEW.user_id
      AND cb.released_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN role = 'employer' AND company_name IS NOT NULL AND company_name <> '' THEN company_name
    ELSE TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
  END
  INTO v_actor_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  v_actor_name := COALESCE(NULLIF(v_actor_name, ''), 'Någon');

  SELECT COALESCE(np.in_app_enabled, true), COALESCE(np.is_enabled, true)
  INTO v_in_app, v_push
  FROM public.notification_preferences np
  WHERE np.user_id = v_msg.sender_id
    AND np.notification_type = 'new_message';

  v_in_app := COALESCE(v_in_app, true);
  v_push := COALESCE(v_push, true);

  IF v_in_app THEN
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    VALUES (
      v_msg.sender_id,
      'message_reaction',
      'Ny reaktion i chatten',
      LEFT(v_actor_name || ' reagerade med ' || NEW.emoji ||
        COALESCE(' på: ' || NULLIF(TRIM(v_msg.content), ''), ' på ditt meddelande'), 140),
      jsonb_build_object(
        'conversation_id', v_msg.conversation_id,
        'message_id', v_msg.id,
        'emoji', NEW.emoji,
        'actor_id', NEW.user_id,
        'route', '/messages'
      )
    );
  END IF;

  IF v_push THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
        headers := public.cron_auth_header(),
        body := jsonb_build_object(
          'recipient_id', v_msg.sender_id,
          'title', v_actor_name,
          'body', 'Reagerade med ' || NEW.emoji,
          'data', jsonb_build_object(
            'type', 'message_reaction',
            'conversation_id', v_msg.conversation_id::text,
            'message_id', v_msg.id::text,
            'sender_id', NEW.user_id::text,
            'route', '/messages'
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_message_reaction push failed for %: %', v_msg.sender_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_message_reaction() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_message_reaction() TO service_role;

DROP TRIGGER IF EXISTS trg_notify_message_reaction ON public.conversation_message_reactions;
CREATE TRIGGER trg_notify_message_reaction
AFTER INSERT ON public.conversation_message_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_message_reaction();