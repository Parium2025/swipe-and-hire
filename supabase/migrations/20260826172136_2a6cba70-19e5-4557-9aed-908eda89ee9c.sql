ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'sek';

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_stripe_price_id_key
  ON public.subscription_plans (stripe_price_id) WHERE stripe_price_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_key
  ON public.user_subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS one_time_purchases_stripe_payment_intent_id_key
  ON public.one_time_purchases (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

GRANT ALL ON public.payment_webhook_events TO service_role;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages payment webhook events"
  ON public.payment_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_payment_webhook_events_updated_at ON public.payment_webhook_events;
CREATE TRIGGER update_payment_webhook_events_updated_at
  BEFORE UPDATE ON public.payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();