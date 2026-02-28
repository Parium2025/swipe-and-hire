
-- Replace the heavy synchronous trigger with a lightweight async call
CREATE OR REPLACE FUNCTION public.notify_saved_search_matches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip inactive/deleted jobs
  IF NEW.is_active = false OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget: delegate matching to edge function asynchronously
  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/check-saved-searches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
    ),
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

  RETURN NEW;
END;
$function$;
