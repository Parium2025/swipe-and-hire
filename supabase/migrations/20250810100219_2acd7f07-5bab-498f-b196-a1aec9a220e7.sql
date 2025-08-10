-- 1) Performance indexes for scale
-- Email confirmations
CREATE INDEX IF NOT EXISTS idx_email_confirmations_user_id ON public.email_confirmations (user_id);
CREATE INDEX IF NOT EXISTS idx_email_confirmations_email ON public.email_confirmations (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_confirmations_token_unique ON public.email_confirmations (token);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- User roles (critical for RLS helper functions)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON public.user_roles (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_active ON public.user_roles (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);

-- Job postings (feed, search, org filters)
CREATE INDEX IF NOT EXISTS idx_job_postings_is_active ON public.job_postings (is_active);
CREATE INDEX IF NOT EXISTS idx_job_postings_org ON public.job_postings (organization_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_employer ON public.job_postings (employer_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON public.job_postings (created_at);

-- Job questions
CREATE INDEX IF NOT EXISTS idx_job_questions_job_id ON public.job_questions (job_id);

-- 2) updated_at triggers for safer write scaling
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_postings_updated_at
BEFORE UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Enforce one profile per user (data integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END$$;

-- 4) Make confirmation links evergreen: stop deleting users/tokens by expiry
CREATE OR REPLACE FUNCTION public.cleanup_expired_confirmations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Do NOT delete users or recent confirmation records anymore.
  -- Optionally prune very old, never-used confirmations to keep the table lean.
  DELETE FROM public.email_confirmations 
  WHERE created_at < now() - interval '365 days' 
    AND confirmed_at IS NULL;
END;
$function$;