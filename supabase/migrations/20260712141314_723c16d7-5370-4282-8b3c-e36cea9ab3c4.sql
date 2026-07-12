
-- =========================================================================
-- A) Universal brygga: notifications-rad -> push till mobil
-- =========================================================================
-- När en rad skapas i public.notifications skickas en push via
-- send-push-notification. Respekterar notification_preferences (is_enabled)
-- när en matchande preference finns; annars default = skicka.

CREATE OR REPLACE FUNCTION public.push_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_push_enabled boolean;
BEGIN
  -- Kontrollera användarens push-preferens för denna typ.
  -- Ingen rad = default true (matchar befintlig UI-default).
  SELECT is_enabled INTO v_push_enabled
  FROM public.notification_preferences
  WHERE user_id = NEW.user_id
    AND notification_type = NEW.type
  LIMIT 1;

  IF v_push_enabled IS NOT NULL AND v_push_enabled = false THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
    ),
    body := jsonb_build_object(
      'recipient_id', NEW.user_id,
      'title', NEW.title,
      'body', COALESCE(NEW.body, ''),
      'data', COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
        'type', NEW.type,
        'notification_id', NEW.id::text
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push-fel får aldrig blockera insert av notis-raden
  RAISE WARNING 'push_on_notification_insert failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_push ON public.notifications;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.push_on_notification_insert();
