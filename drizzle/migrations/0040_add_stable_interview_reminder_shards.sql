ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS reminder_shard smallint
GENERATED ALWAYS AS ((get_byte(uuid_send(id), 0) % 16)::smallint) STORED;

CREATE INDEX IF NOT EXISTS idx_interviews_reminder_shard_due
ON public.interviews (reminder_shard, scheduled_at, id)
WHERE reminder_sent_at IS NULL
  AND status IN ('pending', 'confirmed');

COMMENT ON COLUMN public.interviews.reminder_shard IS 'Stable internal shard used by parallel reminder workers to avoid offset-pagination skips.';