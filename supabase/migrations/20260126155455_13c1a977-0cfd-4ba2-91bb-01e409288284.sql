-- Create a function to notify about new jobs matching saved searches
CREATE OR REPLACE FUNCTION public.notify_saved_search_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  saved_search RECORD;
  matches BOOLEAN;
BEGIN
  -- Only trigger for new active jobs
  IF NEW.is_active = false OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check each saved search
  FOR saved_search IN 
    SELECT * FROM saved_searches
  LOOP
    matches := TRUE;

    -- Check search_query (title or city match)
    IF saved_search.search_query IS NOT NULL AND saved_search.search_query <> '' THEN
      IF NOT (
        LOWER(NEW.title) LIKE '%' || LOWER(saved_search.search_query) || '%' OR
        LOWER(COALESCE(NEW.workplace_city, '')) LIKE '%' || LOWER(saved_search.search_query) || '%'
      ) THEN
        matches := FALSE;
      END IF;
    END IF;

    -- Check city
    IF matches AND saved_search.city IS NOT NULL AND saved_search.city <> '' THEN
      IF NOT (
        LOWER(COALESCE(NEW.workplace_city, '')) LIKE '%' || LOWER(saved_search.city) || '%' OR
        LOWER(COALESCE(NEW.workplace_municipality, '')) LIKE '%' || LOWER(saved_search.city) || '%'
      ) THEN
        matches := FALSE;
      END IF;
    END IF;

    -- Check county
    IF matches AND saved_search.county IS NOT NULL AND saved_search.county <> '' THEN
      IF NEW.workplace_county <> saved_search.county THEN
        matches := FALSE;
      END IF;
    END IF;

    -- Check employment_types
    IF matches AND saved_search.employment_types IS NOT NULL AND array_length(saved_search.employment_types, 1) > 0 THEN
      IF NOT (NEW.employment_type = ANY(saved_search.employment_types)) THEN
        matches := FALSE;
      END IF;
    END IF;

    -- Check category
    IF matches AND saved_search.category IS NOT NULL AND saved_search.category <> '' THEN
      IF NEW.category <> saved_search.category THEN
        matches := FALSE;
      END IF;
    END IF;

    -- Check salary range
    IF matches AND saved_search.salary_min IS NOT NULL THEN
      IF NEW.salary_max IS NOT NULL AND NEW.salary_max < saved_search.salary_min THEN
        matches := FALSE;
      END IF;
    END IF;

    IF matches AND saved_search.salary_max IS NOT NULL THEN
      IF NEW.salary_min IS NOT NULL AND NEW.salary_min > saved_search.salary_max THEN
        matches := FALSE;
      END IF;
    END IF;

    -- If matches, increment the counter
    IF matches THEN
      UPDATE saved_searches
      SET new_matches_count = new_matches_count + 1,
          updated_at = now()
      WHERE id = saved_search.id;

      -- Send push notification via pg_net
      PERFORM net.http_post(
        url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
        ),
        body := jsonb_build_object(
          'recipient_id', saved_search.user_id,
          'title', '🔔 Nytt jobb matchar din sökning!',
          'body', NEW.title || ' - ' || COALESCE(NEW.workplace_city, 'Okänd plats'),
          'data', jsonb_build_object(
            'type', 'saved_search_match',
            'job_id', NEW.id,
            'search_id', saved_search.id,
            'route', '/job-view/' || NEW.id::text
          )
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Create trigger on job_postings for new jobs
DROP TRIGGER IF EXISTS on_new_job_check_saved_searches ON job_postings;
CREATE TRIGGER on_new_job_check_saved_searches
  AFTER INSERT ON job_postings
  FOR EACH ROW
  EXECUTE FUNCTION notify_saved_search_matches();