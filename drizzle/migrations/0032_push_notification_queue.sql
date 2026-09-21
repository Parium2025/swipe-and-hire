-- Kö för pushnotiser. Vid en ny annons kan tiotusentals bevakningar träffa
-- samtidigt. I stället för att skicka allt i samma körning läggs notiserna i
-- den här kön och arbetaren betar av dem i jämn takt, utspridda över tid.

CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id BIGSERIAL PRIMARY KEY,
  recipient_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_type TEXT,
  dedupe_key TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Endast serverkoden rör kön; ingen klient ska läsa eller skriva.
GRANT ALL ON public.push_notification_queue TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_notification_queue_id_seq TO service_role;

ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_queue_service_role_only"
  ON public.push_notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Arbetarens hämtning: väntande poster som är mogna, i stabil ordning.
CREATE INDEX IF NOT EXISTS idx_push_queue_due
  ON public.push_notification_queue (scheduled_at, id)
  WHERE status = 'pending';

-- Städning av avklarade poster.
CREATE INDEX IF NOT EXISTS idx_push_queue_cleanup
  ON public.push_notification_queue (status, created_at);

-- Samma notis ska aldrig kunna läggas i kön två gånger.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_queue_dedupe
  ON public.push_notification_queue (dedupe_key)
  WHERE dedupe_key IS NOT NULL;


-- Lägg många notiser i kön i ETT anrop. Dubbletter hoppas tyst över.
CREATE OR REPLACE FUNCTION public.enqueue_push_notifications(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted INTEGER;
BEGIN
  INSERT INTO public.push_notification_queue
    (recipient_id, title, body, data, notification_type, dedupe_key, scheduled_at)
  SELECT
    (r->>'recipient_id')::uuid,
    r->>'title',
    r->>'body',
    COALESCE(r->'data', '{}'::jsonb),
    r->>'notification_type',
    r->>'dedupe_key',
    COALESCE((r->>'scheduled_at')::timestamptz, now())
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_push_notifications(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_push_notifications(JSONB) TO service_role;


-- Plocka nästa sats. SKIP LOCKED gör att flera arbetare kan köra parallellt
-- utan att någonsin ta samma rad.
CREATE OR REPLACE FUNCTION public.claim_push_notifications(p_limit INTEGER)
RETURNS SETOF public.push_notification_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.push_notification_queue q
  SET status = 'processing',
      claimed_at = now(),
      attempts = q.attempts + 1
  WHERE q.id IN (
    SELECT c.id
    FROM public.push_notification_queue c
    WHERE (
      (c.status = 'pending' AND c.scheduled_at <= now())
      -- Fastnade poster (arbetaren dog mitt i) återtas efter 5 minuter.
      OR (c.status = 'processing' AND c.claimed_at < now() - interval '5 minutes' AND c.attempts < 3)
    )
    ORDER BY c.scheduled_at, c.id
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
$$;

REVOKE ALL ON FUNCTION public.claim_push_notifications(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_notifications(INTEGER) TO service_role;


-- Markera resultat för en hel sats i ETT anrop.
CREATE OR REPLACE FUNCTION public.complete_push_notifications(
  p_sent_ids BIGINT[],
  p_failed_ids BIGINT[],
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sent_ids IS NOT NULL AND array_length(p_sent_ids, 1) > 0 THEN
    UPDATE public.push_notification_queue
    SET status = 'sent', sent_at = now(), last_error = NULL
    WHERE id = ANY(p_sent_ids);
  END IF;

  IF p_failed_ids IS NOT NULL AND array_length(p_failed_ids, 1) > 0 THEN
    UPDATE public.push_notification_queue
    SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
        scheduled_at = CASE WHEN attempts >= 3 THEN scheduled_at ELSE now() + interval '2 minutes' END,
        last_error = p_error
    WHERE id = ANY(p_failed_ids);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_push_notifications(BIGINT[], BIGINT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_push_notifications(BIGINT[], BIGINT[], TEXT) TO service_role;


-- Håll kön liten: avklarade poster äldre än tre dygn tas bort.
CREATE OR REPLACE FUNCTION public.cleanup_push_notification_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM public.push_notification_queue
  WHERE status IN ('sent', 'failed')
    AND created_at < now() - interval '3 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_push_notification_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_push_notification_queue() TO service_role;