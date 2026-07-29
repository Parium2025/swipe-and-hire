CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    role,
    company_name,
    org_number,
    industry,
    address,
    website,
    company_description,
    employee_count,
    phone
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

  -- Släpp e-postspärren automatiskt vid ny registrering.
  -- Spam-anmälan ('complaint') ligger kvar och släpps bara manuellt.
  IF new.email IS NOT NULL THEN
    DELETE FROM public.suppressed_emails
    WHERE lower(email) = lower(new.email)
      AND reason IN ('account_deleted', 'account_deleted_inactive', 'unsubscribe', 'bounce');
  END IF;

  RETURN new;
END;
$function$;