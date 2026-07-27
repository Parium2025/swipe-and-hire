CREATE TABLE IF NOT EXISTS public.admin_alert_cooldowns (
  alert_key TEXT PRIMARY KEY,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_count INTEGER NOT NULL DEFAULT 1
);

GRANT ALL ON public.admin_alert_cooldowns TO service_role;
ALTER TABLE public.admin_alert_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_admin_alert(_alert_key TEXT, _cooldown_minutes INTEGER DEFAULT 360)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed BOOLEAN := false;
BEGIN
  INSERT INTO public.admin_alert_cooldowns (alert_key, last_sent_at, send_count)
  VALUES (_alert_key, now(), 1)
  ON CONFLICT (alert_key) DO UPDATE
    SET last_sent_at = now(),
        send_count = public.admin_alert_cooldowns.send_count + 1
    WHERE public.admin_alert_cooldowns.last_sent_at < now() - make_interval(mins => _cooldown_minutes)
  RETURNING true INTO claimed;

  RETURN COALESCE(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_alert(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_alert(TEXT, INTEGER) TO service_role;