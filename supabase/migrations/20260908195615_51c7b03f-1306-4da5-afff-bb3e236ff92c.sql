CREATE OR REPLACE FUNCTION public.notify_conversation_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  SELECT
    cm.user_id,
    'new_message',
    'Nytt chattmeddelande',
    LEFT(COALESCE(NULLIF(TRIM(NEW.content), ''), 'Du har fått ett nytt meddelande'), 140),
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  FROM public.conversation_members cm
  LEFT JOIN public.notification_preferences np
    ON np.user_id = cm.user_id
   AND np.notification_type = 'new_message'
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.muted_at IS NULL
    AND COALESCE(np.in_app_enabled, true)
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_blocks cb
      WHERE cb.blocker_id = cm.user_id
        AND cb.blocked_id = NEW.sender_id
        AND cb.released_at IS NULL
    );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.push_on_conversation_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sender_name text;
  v_recipient record;
  v_preview text;
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN role = 'employer' AND company_name IS NOT NULL AND company_name <> '' THEN company_name
    ELSE TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
  END
  INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  v_sender_name := COALESCE(NULLIF(v_sender_name, ''), 'Nytt meddelande');
  v_preview := CASE
    WHEN NULLIF(NEW.content, '') IS NOT NULL THEN LEFT(NEW.content, 120)
    WHEN NEW.attachment_url IS NOT NULL THEN 'Skickade en bilaga'
    ELSE 'Nytt meddelande'
  END;

  FOR v_recipient IN
    SELECT cm.user_id
    FROM public.conversation_members cm
    LEFT JOIN public.notification_preferences np
      ON np.user_id = cm.user_id
     AND np.notification_type = 'new_message'
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id
      AND cm.muted_at IS NULL
      AND COALESCE(np.is_enabled, true)
      AND NOT EXISTS (
        SELECT 1
        FROM public.conversation_blocks cb
        WHERE cb.blocker_id = cm.user_id
          AND cb.blocked_id = NEW.sender_id
          AND cb.released_at IS NULL
      )
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
        headers := public.cron_auth_header(),
        body := jsonb_build_object(
          'recipient_id', v_recipient.user_id,
          'title', v_sender_name,
          'body', v_preview,
          'data', jsonb_build_object(
            'type', 'message',
            'conversation_id', NEW.conversation_id::text,
            'message_id', NEW.id::text,
            'sender_id', NEW.sender_id::text,
            'route', '/messages'
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push_on_conversation_message failed for %: %', v_recipient.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_conversation_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_on_conversation_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_conversation_new_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.push_on_conversation_message() TO service_role;