
-- Add email_enabled column to notification_preferences
-- is_enabled = push/in-app notifications, email_enabled = email notifications
ALTER TABLE public.notification_preferences
ADD COLUMN email_enabled boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.notification_preferences.is_enabled IS 'Controls push/in-app notifications';
COMMENT ON COLUMN public.notification_preferences.email_enabled IS 'Controls email notifications';
