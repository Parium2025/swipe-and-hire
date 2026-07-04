
CREATE TYPE public.plan_tier AS ENUM ('one_time', 'start', 'vaxa', 'pro', 'jobseeker_premium');
CREATE TYPE public.plan_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
CREATE TYPE public.plan_billing_period AS ENUM ('monthly', 'one_time');
CREATE TYPE public.plan_source AS ENUM ('stripe', 'manual', 'trial');

CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier plan_tier NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_sek integer NOT NULL,
  billing_period plan_billing_period NOT NULL,
  max_active_jobs integer,
  max_users integer,
  includes_candidate_bank boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  tier plan_tier NOT NULL,
  status plan_status NOT NULL DEFAULT 'pending',
  source plan_source NOT NULL DEFAULT 'stripe',
  started_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_org ON public.user_subscriptions(organization_id);
CREATE INDEX idx_user_subscriptions_active ON public.user_subscriptions(status) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view org subscriptions" ON public.user_subscriptions
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

CREATE TABLE public.one_time_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  price_sek integer NOT NULL DEFAULT 799,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  job_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,
  status plan_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_one_time_user ON public.one_time_purchases(user_id);
CREATE INDEX idx_one_time_status ON public.one_time_purchases(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.one_time_purchases TO authenticated;
GRANT ALL ON public.one_time_purchases TO service_role;
ALTER TABLE public.one_time_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.one_time_purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view org purchases" ON public.one_time_purchases
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.set_plan_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_subscription_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_updated_at();
CREATE TRIGGER trg_user_subscriptions_updated BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_updated_at();
CREATE TRIGGER trg_one_time_purchases_updated BEFORE UPDATE ON public.one_time_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_plan_updated_at();

CREATE OR REPLACE FUNCTION public.has_active_plan(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = _user_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) OR EXISTS (
    SELECT 1 FROM public.user_subscriptions us
    WHERE us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > now())
      AND us.organization_id IS NOT NULL
      AND us.organization_id = public.get_user_organization_id(_user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.one_time_purchases
    WHERE user_id = _user_id AND status = 'active'
      AND (activated_at IS NULL OR expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_active_plan_details(_user_id uuid)
RETURNS TABLE(
  source_type text,
  tier plan_tier,
  status plan_status,
  expires_at timestamptz,
  max_active_jobs integer,
  max_users integer,
  plan_name text,
  price_sek integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH personal AS (
    SELECT 'subscription'::text AS source_type, us.tier, us.status, us.expires_at,
           sp.max_active_jobs, sp.max_users, sp.name AS plan_name, sp.price_sek
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.tier = us.tier
    WHERE us.user_id = _user_id AND us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > now())
    ORDER BY sp.price_sek DESC LIMIT 1
  ),
  org_plan AS (
    SELECT 'org_subscription'::text, us.tier, us.status, us.expires_at,
           sp.max_active_jobs, sp.max_users, sp.name, sp.price_sek
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.tier = us.tier
    WHERE us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > now())
      AND us.organization_id IS NOT NULL
      AND us.organization_id = public.get_user_organization_id(_user_id)
    ORDER BY sp.price_sek DESC LIMIT 1
  ),
  one_time AS (
    SELECT 'one_time'::text, 'one_time'::plan_tier, otp.status, otp.expires_at,
           1, 1, sp.name, otp.price_sek
    FROM public.one_time_purchases otp
    LEFT JOIN public.subscription_plans sp ON sp.tier = 'one_time'
    WHERE otp.user_id = _user_id AND otp.status = 'active'
      AND (otp.activated_at IS NULL OR otp.expires_at IS NULL OR otp.expires_at > now())
    ORDER BY otp.purchased_at DESC LIMIT 1
  )
  SELECT * FROM personal
  UNION ALL
  SELECT * FROM org_plan WHERE NOT EXISTS (SELECT 1 FROM personal)
  UNION ALL
  SELECT * FROM one_time WHERE NOT EXISTS (SELECT 1 FROM personal) AND NOT EXISTS (SELECT 1 FROM org_plan);
$$;

GRANT EXECUTE ON FUNCTION public.has_active_plan(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_active_plan_details(uuid) TO authenticated;

INSERT INTO public.subscription_plans (tier, name, description, price_sek, billing_period, max_active_jobs, max_users, includes_candidate_bank, features, sort_order) VALUES
  ('one_time', 'Engångsköp', 'En annons, 14 dagar aktiv från publicering', 799, 'one_time', 1, 1, true,
   '["1 annons live i 14 dagar", "Full tillgång till kandidatbank", "Chatt med kandidater", "Ingen bindningstid"]'::jsonb, 1),
  ('start', 'Start', 'För mindre företag som rekryterar regelbundet', 5000, 'monthly', 40, 1, true,
   '["Upp till 40 aktiva annonser", "1 användare", "Full kandidatbank", "Chatt & pipeline", "Ingen bindningstid"]'::jsonb, 2),
  ('vaxa', 'Växa', 'När ni är fler som rekryterar tillsammans', 7500, 'monthly', 80, 2, true,
   '["Upp till 80 aktiva annonser", "2 användare", "Full kandidatbank", "Team-samarbete", "Prioriterad support"]'::jsonb, 3),
  ('pro', 'Pro', 'Obegränsat för seriösa rekryteringsteam', 10000, 'monthly', NULL, NULL, true,
   '["Obegränsat antal annonser", "Obegränsat antal användare", "All funktionalitet inkluderad", "Prioriterad support", "Early access till nya funktioner"]'::jsonb, 4),
  ('jobseeker_premium', 'Jobbsökar-Premium', 'För dig som söker jobb aktivt', 29, 'monthly', 0, 1, false,
   '["Se vilka som tittat på din profil", "Prioriterad synlighet för arbetsgivare", "Obegränsat antal ansökningar", "Ingen bindningstid"]'::jsonb, 5);
