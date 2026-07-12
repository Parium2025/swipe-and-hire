
-- =========================================================================
-- B) Push för nya chat-meddelanden (conversation_messages)
-- =========================================================================
-- Ersätter den gamla notify_new_message-triggern som togs bort när
-- systemet migrerade från 'messages' till 'conversation_messages'.

CREATE OR REPLACE FUNCTION public.push_on_conversation_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_name text;
  v_recipient record;
  v_push_enabled boolean;
  v_preview text;
BEGIN
  -- Skippa systemmeddelanden helt
  IF NEW.is_system_message = true THEN
    RETURN NEW;
  END IF;

  -- Hämta avsändarens visningsnamn
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

  -- Preview (bilagor -> generisk text)
  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    v_preview := LEFT(NEW.content, 120);
  ELSIF NEW.attachment_url IS NOT NULL THEN
    v_preview := 'Skickade en bilaga';
  ELSE
    v_preview := 'Nytt meddelande';
  END IF;

  -- Push till alla medlemmar utom avsändaren
  FOR v_recipient IN
    SELECT user_id
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
  LOOP
    -- Respektera push-preferens 'new_message' om satt
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

DROP TRIGGER IF EXISTS on_conversation_message_push ON public.conversation_messages;
CREATE TRIGGER on_conversation_message_push
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.push_on_conversation_message();
