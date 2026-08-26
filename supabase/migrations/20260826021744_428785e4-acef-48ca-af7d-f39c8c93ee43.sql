CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(new.raw_user_meta_data ->> 'role', 'job_seeker');
  v_accepted timestamptz := COALESCE(
    (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz,
    now()
  );
  v_policy_version text := COALESCE(new.raw_user_meta_data ->> 'policy_version', '2026-01');
  v_dpa_version text := COALESCE(new.raw_user_meta_data ->> 'dpa_version', '2026-01');
  v_org_id uuid;
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

  -- Samtyckeslogg (GDPR art. 7.1)
  INSERT INTO public.consent_records (user_id, email, role, consent_type, document_version, document_url, accepted_at, source)
  VALUES (new.id, new.email, v_role, 'privacy_policy', v_policy_version, 'https://www.parium.se/integritetspolicy', v_accepted, 'signup');

  IF v_role = 'employer' THEN
    INSERT INTO public.consent_records (user_id, email, role, consent_type, document_version, document_url, accepted_at, source)
    VALUES (new.id, new.email, v_role, 'dpa', v_dpa_version, 'https://www.parium.se/dpa', v_accepted, 'signup');

    -- Egen organisation + grundande administratör
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NULLIF(new.raw_user_meta_data ->> 'company_name', ''), 'Min organisation'))
    RETURNING id INTO v_org_id;

    INSERT INTO public.user_roles (user_id, role, organization_id, is_active)
    VALUES (new.id, 'admin', v_org_id, true)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET organization_id = v_org_id WHERE user_id = new.id;
  END IF;

  IF new.email IS NOT NULL THEN
    DELETE FROM public.suppressed_emails
    WHERE lower(email) = lower(new.email)
      AND reason IN ('account_deleted', 'account_deleted_inactive', 'unsubscribe', 'bounce');
  END IF;

  RETURN new;
END;
$function$;