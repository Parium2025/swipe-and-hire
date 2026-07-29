CREATE TABLE public.consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  role text,
  consent_type text NOT NULL,
  document_version text NOT NULL,
  document_url text,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'signup',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own consent records"
ON public.consent_records FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_consent_records_user ON public.consent_records (user_id, accepted_at DESC);
CREATE INDEX idx_consent_records_accepted_at ON public.consent_records (accepted_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(new.raw_user_meta_data ->> 'role', 'job_seeker');
  v_accepted timestamptz := COALESCE(
    (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz,
    now()
  );
  v_policy_version text := COALESCE(new.raw_user_meta_data ->> 'policy_version', '2026-01');
  v_dpa_version text := COALESCE(new.raw_user_meta_data ->> 'dpa_version', '2026-01');
BEGIN
  INSERT INTO public.profiles (
    user_id, first_name, last_name, role, company_name, org_number,
    industry, address, website, company_description, employee_count, phone
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    COALESCE((new.raw_user_meta_data ->> 'role')::user_role, 'job_seeker'),
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'org_number',
    new.raw_user_meta_data ->> 'industry',
    new.raw_user_meta_data ->> 'address',
    new.raw_user_meta_data ->> 'website',
    new.raw_user_meta_data ->> 'company_description',
    new.raw_user_meta_data ->> 'employee_count',
    new.raw_user_meta_data ->> 'phone'
  );

  -- Samtyckeslogg (GDPR art. 7.1 – ansvarsskyldighet)
  INSERT INTO public.consent_records (user_id, email, role, consent_type, document_version, document_url, accepted_at, source)
  VALUES (new.id, new.email, v_role, 'privacy_policy', v_policy_version, 'https://www.parium.se/integritetspolicy', v_accepted, 'signup');

  IF v_role = 'employer' THEN
    INSERT INTO public.consent_records (user_id, email, role, consent_type, document_version, document_url, accepted_at, source)
    VALUES (new.id, new.email, v_role, 'dpa', v_dpa_version, 'https://www.parium.se/dpa', v_accepted, 'signup');
  END IF;

  -- Släpp e-postspärren automatiskt vid ny registrering.
  IF new.email IS NOT NULL THEN
    DELETE FROM public.suppressed_emails
    WHERE lower(email) = lower(new.email)
      AND reason IN ('account_deleted', 'account_deleted_inactive', 'unsubscribe', 'bounce');
  END IF;

  RETURN new;
END;
$$;