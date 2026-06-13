-- Premium fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

-- Index for fast premium lookups
CREATE INDEX IF NOT EXISTS idx_profiles_premium
  ON public.profiles (user_id)
  WHERE is_premium = true OR premium_until IS NOT NULL;

-- Single source of truth for premium access
CREATE OR REPLACE FUNCTION public.has_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND (
        is_premium = true
        OR (premium_until IS NOT NULL AND premium_until > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_premium(uuid) TO authenticated, service_role;