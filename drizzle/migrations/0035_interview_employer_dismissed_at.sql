-- Arbetsgivaren kan själv rensa bort avböjda och avslutade intervjuer från kortet.
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS employer_dismissed_at timestamptz;

COMMENT ON COLUMN public.interviews.employer_dismissed_at IS
  'Satt när arbetsgivaren manuellt tagit bort intervjun från sitt översiktskort. Påverkar inte intervjuns status eller kalendern.';

CREATE INDEX IF NOT EXISTS interviews_employer_active_idx
  ON public.interviews (employer_id, scheduled_at)
  WHERE employer_dismissed_at IS NULL;