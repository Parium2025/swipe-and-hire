-- BLOCKED CONTRACT MIGRATION — intentionally outside supabase/migrations.
--
-- Deploy order:
--   1. Apply the 21000, 22000, 23000, 24500 and 25000 expand migrations
--      in staging after their table-size/index-lock preflights pass.
--   2. Deploy custom-signup, resend-confirmation, confirm-email,
--      send-reset-password and cleanup-expired-confirmations together, then
--      verify real signup, confirmation, resend and reset flows in staging.
--   3. Fill the evidence values below and promote this file with a new unused
--      timestamp.
--   4. Immediately after apply, smoke-test custom signup still succeeds and
--      direct /auth/v1/signup is denied. Roll back the function if either
--      post-apply assertion fails.
--
-- Once promoted, rolling custom-signup back to a build without
-- parium_signup_channel would block all signups. Roll back this function to
-- the prior definition before rolling the edge function back.

DO $contract_preflight$
DECLARE
  v_custom_signup_edge_commit text := NULL;
  v_staging_signup_verified_at timestamptz := NULL;
  v_verified_by text := NULL;
BEGIN
  IF v_custom_signup_edge_commit IS NULL
     OR v_custom_signup_edge_commit !~ '^[0-9a-fA-F]{7,40}$' THEN
    RAISE EXCEPTION 'Contract migration blocked: verified custom-signup commit is required';
  END IF;

  IF v_staging_signup_verified_at IS NULL
     OR v_staging_signup_verified_at > clock_timestamp()
     OR clock_timestamp() - v_staging_signup_verified_at > interval '24 hours' THEN
    RAISE EXCEPTION 'Contract migration blocked: fresh staging custom-signup evidence is required';
  END IF;

  IF v_verified_by IS NULL
     OR v_verified_by !~ '^[^<>]{2,}\s+<[^<>@\s]+@[^<>@\s]+>$' THEN
    RAISE EXCEPTION 'Contract migration blocked: named approver and email are required';
  END IF;

  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.consent_records') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.suppressed_emails') IS NULL THEN
    RAISE EXCEPTION 'Contract migration blocked: required signup tables are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS signup_trigger
    JOIN pg_catalog.pg_proc AS trigger_function
      ON trigger_function.oid = signup_trigger.tgfoid
    JOIN pg_catalog.pg_namespace AS trigger_namespace
      ON trigger_namespace.oid = trigger_function.pronamespace
    WHERE signup_trigger.tgrelid = 'auth.users'::regclass
      AND NOT signup_trigger.tgisinternal
      AND signup_trigger.tgenabled IN ('O', 'A')
      AND (signup_trigger.tgtype & 4) = 4
      AND (signup_trigger.tgtype & 1) = 1
      AND trigger_namespace.nspname = 'public'
      AND trigger_function.proname = 'handle_new_user'
  ) THEN
    RAISE EXCEPTION 'Contract migration blocked: auth.users signup trigger is missing or misbound';
  END IF;
END
$contract_preflight$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_signup_channel text := NULLIF(btrim(new.raw_app_meta_data ->> 'parium_signup_channel'), '');
  v_role text := NULLIF(btrim(new.raw_user_meta_data ->> 'role'), '');
  v_terms_text text := NULLIF(btrim(new.raw_user_meta_data ->> 'terms_accepted_at'), '');
  v_policy_version text := NULLIF(btrim(new.raw_user_meta_data ->> 'policy_version'), '');
  v_dpa_version text := NULLIF(btrim(new.raw_user_meta_data ->> 'dpa_version'), '');
  v_submitted_at timestamptz;
  v_accepted_at timestamptz := clock_timestamp();
  v_org_id uuid;
BEGIN
  -- raw_app_meta_data is service-role controlled. Browser-supplied
  -- raw_user_meta_data can never opt itself into this provisioning channel.
  IF v_signup_channel IS NULL OR v_signup_channel <> 'custom-signup-v1' THEN
    RAISE EXCEPTION 'untrusted signup provisioning channel'
      USING ERRCODE = '42501';
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('job_seeker', 'employer') THEN
    RAISE EXCEPTION 'signup role is required and must be supported'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(new.raw_user_meta_data ->> 'terms_accepted_at'), '') IS NULL THEN
    RAISE EXCEPTION 'privacy consent timestamp is required'
      USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(new.raw_user_meta_data ->> 'policy_version'), '') IS NULL
     OR char_length(v_policy_version) > 64
     OR v_policy_version <> '2026-01' THEN
    RAISE EXCEPTION 'privacy policy version is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_role = 'employer'
     AND (
       v_dpa_version IS NULL
       OR char_length(v_dpa_version) > 64
       OR v_dpa_version <> '2026-01'
     ) THEN
    RAISE EXCEPTION 'DPA consent version is required for employers'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_submitted_at := v_terms_text::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'privacy consent timestamp is invalid'
      USING ERRCODE = '22007';
  END;

  IF v_submitted_at < v_accepted_at - interval '24 hours'
     OR v_submitted_at > v_accepted_at + interval '5 minutes' THEN
    RAISE EXCEPTION 'privacy consent timestamp is outside the accepted window'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (
    user_id, first_name, last_name, role, company_name, org_number,
    industry, address, website, company_description, employee_count, phone
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    v_role::public.user_role,
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'org_number',
    new.raw_user_meta_data ->> 'industry',
    new.raw_user_meta_data ->> 'address',
    new.raw_user_meta_data ->> 'website',
    new.raw_user_meta_data ->> 'company_description',
    new.raw_user_meta_data ->> 'employee_count',
    new.raw_user_meta_data ->> 'phone'
  );

  INSERT INTO public.consent_records (
    user_id, email, role, consent_type, document_version,
    document_url, accepted_at, source
  )
  VALUES (
    new.id, new.email, v_role, 'privacy_policy', v_policy_version,
    'https://www.parium.se/integritetspolicy', v_accepted_at, 'signup'
  );

  IF v_role = 'employer' THEN
    INSERT INTO public.consent_records (
      user_id, email, role, consent_type, document_version,
      document_url, accepted_at, source
    )
    VALUES (
      new.id, new.email, v_role, 'dpa', v_dpa_version,
      'https://www.parium.se/dpa', v_accepted_at, 'signup'
    );

    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NULLIF(new.raw_user_meta_data ->> 'company_name', ''), 'Min organisation'))
    RETURNING id INTO v_org_id;

    INSERT INTO public.user_roles (user_id, role, organization_id, is_active)
    VALUES (new.id, 'admin', v_org_id, true)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles
    SET organization_id = v_org_id
    WHERE user_id = new.id;
  END IF;

  IF new.email IS NOT NULL THEN
    DELETE FROM public.suppressed_emails
    WHERE lower(email) = lower(new.email)
      AND reason IN ('account_deleted', 'account_deleted_inactive');
  END IF;

  RETURN new;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Atomic server-marked custom signup provisioning with fail-closed consent validation and preserved mail suppression.';
