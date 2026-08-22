CREATE OR REPLACE FUNCTION public.push_on_conversation_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_recipient record;
  v_push_enabled boolean;
  v_preview text;
BEGIN
  IF NEW.is_system_message = true THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE
      WHEN role = 'employer' AND company_name IS NOT NULL AND company_name <> ''
        THEN company_name
      ELSE TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
    END
  INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  IF v_sender_name IS NULL OR v_sender_name = '' THEN
    v_sender_name := 'Nytt meddelande';
  END IF;

  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    v_preview := LEFT(NEW.content, 120);
  ELSIF NEW.attachment_url IS NOT NULL THEN
    v_preview := 'Skickade en bilaga';
  ELSE
    v_preview := 'Nytt meddelande';
  END IF;

  -- Push till alla medlemmar utom avsändaren, men aldrig till den som tystat chatten
  FOR v_recipient IN
    SELECT user_id
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
      AND muted_at IS NULL
  LOOP
    SELECT is_enabled INTO v_push_enabled
    FROM public.notification_preferences
    WHERE user_id = v_recipient.user_id
      AND notification_type = 'new_message'
    LIMIT 1;

    IF v_push_enabled IS NOT NULL AND v_push_enabled = false THEN
      CONTINUE;
    END IF;

    BEGIN
      PERFORM net.http_post(
        url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
        ),
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
$$;