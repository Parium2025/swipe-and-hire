ALTER TABLE public.account_inactivity_notices
  ADD COLUMN IF NOT EXISTS reminder_180_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_90_sent_at timestamptz;