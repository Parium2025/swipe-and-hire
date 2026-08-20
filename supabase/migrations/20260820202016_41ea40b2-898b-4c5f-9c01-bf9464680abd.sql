CREATE TABLE IF NOT EXISTS public.outreach_defaults_seeded (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seeded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.outreach_defaults_seeded TO authenticated;
GRANT ALL ON public.outreach_defaults_seeded TO service_role;

ALTER TABLE public.outreach_defaults_seeded ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own outreach seed marker" ON public.outreach_defaults_seeded;
CREATE POLICY "Users manage own outreach seed marker"
ON public.outreach_defaults_seeded
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());