CREATE OR REPLACE FUNCTION public.notify_saved_search_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active = false OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Den interna tjänstenyckeln krävs; den publika nyckeln avvisades tidigare,
  -- så bevakningarna kördes aldrig live vid publicering.
  BEGIN
    PERFORM net.http_post(
      url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/check-saved-searches',
      headers := public.cron_auth_header(),
      body := jsonb_build_object(
        'job_id', NEW.id,
        'title', NEW.title,
        'workplace_city', NEW.workplace_city,
        'workplace_municipality', NEW.workplace_municipality,
        'workplace_county', NEW.workplace_county,
        'employment_type', NEW.employment_type,
        'category', NEW.category,
        'salary_min', NEW.salary_min,
        'salary_max', NEW.salary_max
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Publiceringen får aldrig stoppas av bevakningen.
    RAISE WARNING 'notify_saved_search_matches: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;