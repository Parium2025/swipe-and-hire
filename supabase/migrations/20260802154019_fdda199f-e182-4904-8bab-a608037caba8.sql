CREATE TABLE public.user_onboarding_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tunnel_draft JSONB,
  coach_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_onboarding_state TO authenticated;
GRANT ALL ON public.user_onboarding_state TO service_role;

ALTER TABLE public.user_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own onboarding state"
ON public.user_onboarding_state
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_onboarding_state_updated_at
BEFORE UPDATE ON public.user_onboarding_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();