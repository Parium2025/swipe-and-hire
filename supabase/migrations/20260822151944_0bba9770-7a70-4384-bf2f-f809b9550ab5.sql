CREATE TABLE public.candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  cv_url text,
  cv_filename text,
  video_url text,
  profile_image_url text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_profiles TO authenticated;
GRANT ALL ON public.candidate_profiles TO service_role;

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own candidate profiles"
ON public.candidate_profiles FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_candidate_profiles_user ON public.candidate_profiles(user_id, sort_order);
CREATE UNIQUE INDEX uq_candidate_profiles_default ON public.candidate_profiles(user_id) WHERE is_default;

CREATE OR REPLACE FUNCTION public.enforce_candidate_profile_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.candidate_profiles WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'Max 3 kandidatprofiler per anvandare';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_candidate_profile_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_candidate_profiles_limit
BEFORE INSERT ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_candidate_profile_limit();

CREATE TRIGGER trg_candidate_profiles_updated_at
BEFORE UPDATE ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.job_applications ADD COLUMN candidate_profile_label text;