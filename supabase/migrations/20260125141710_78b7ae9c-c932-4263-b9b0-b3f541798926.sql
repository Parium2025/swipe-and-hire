-- Create trigger function to send push notification for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_name text;
BEGIN
  -- Get sender's name for the notification
  SELECT 
    CASE 
      WHEN role = 'employer' AND company_name IS NOT NULL THEN company_name
      ELSE CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))
    END INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  -- Call the send-push-notification edge function via pg_net
  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
    ),
    body := jsonb_build_object(
      'recipient_id', NEW.recipient_id,
      'title', COALESCE(v_sender_name, 'Nytt meddelande'),
      'body', LEFT(NEW.content, 100),
      'data', jsonb_build_object(
        'type', 'message',
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    )
  );

  RETURN NEW;
END;
$function$;

-- Create trigger on messages table for INSERT
DROP TRIGGER IF EXISTS on_new_message_notify ON public.messages;
CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Add indexes for better scalability (if not exists, they're already there)
-- Create composite index for thread queries (sender + recipient + created_at)
CREATE INDEX IF NOT EXISTS idx_messages_thread 
ON public.messages (sender_id, recipient_id, created_at DESC);

-- Create index for recipient queries ordered by date
CREATE INDEX IF NOT EXISTS idx_messages_recipient_date 
ON public.messages (recipient_id, created_at DESC);