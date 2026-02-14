
-- 1. Remove the status change notification trigger and function
DROP TRIGGER IF EXISTS on_application_status_change_notify ON public.job_applications;
DROP FUNCTION IF EXISTS public.notify_application_status_change() CASCADE;

-- 2. Create notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Helper function to check if a notification is enabled
CREATE OR REPLACE FUNCTION public.is_notification_enabled(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM notification_preferences WHERE user_id = p_user_id AND notification_type = p_type),
    true
  );
$$;

-- 4. Update notify_new_application to check preferences
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_title TEXT;
  v_applicant_name TEXT;
  v_employer_id UUID;
BEGIN
  SELECT title, employer_id INTO v_job_title, v_employer_id
  FROM job_postings WHERE id = NEW.job_id;

  IF NOT is_notification_enabled(v_employer_id, 'new_application') THEN
    RETURN NEW;
  END IF;

  v_applicant_name := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
  v_applicant_name := TRIM(v_applicant_name);
  IF v_applicant_name = '' THEN v_applicant_name := 'En kandidat'; END IF;

  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (
    v_employer_id,
    'new_application',
    'Ny ansökan',
    v_applicant_name || ' har sökt tjänsten ' || COALESCE(v_job_title, 'Okänd tjänst'),
    jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id, 'applicant_id', NEW.applicant_id, 'route', '/candidates')
  );

  RETURN NEW;
END;
$$;

-- 5. Update notify_new_message to check preferences
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_name text;
BEGIN
  IF NOT is_notification_enabled(NEW.recipient_id, 'new_message') THEN
    RETURN NEW;
  END IF;

  SELECT 
    CASE 
      WHEN role = 'employer' AND company_name IS NOT NULL THEN company_name
      ELSE CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))
    END INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  PERFORM net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyamFlZ2FwdXVqdXNoc2lvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjkzMjYsImV4cCI6MjA3OTE0NTMyNn0.mEr8DfMmx8kAX7YttCGEX9B4CZZcoo8l_rI0-EFFpQA'
    ),
    body := jsonb_build_object(
      'recipient_id', NEW.recipient_id,
      'title', COALESCE(v_sender_name, 'Nytt meddelande'),
      'body', LEFT(NEW.content, 100),
      'data', jsonb_build_object(
        'type', 'message',
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    )
  );

  RETURN NEW;
END;
$$;

-- 6. Update notify_interview_scheduled to check preferences
CREATE OR REPLACE FUNCTION public.notify_interview_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_title TEXT;
BEGIN
  IF NOT is_notification_enabled(NEW.applicant_id, 'interview_scheduled') THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;

  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (
    NEW.applicant_id,
    'interview_scheduled',
    'Intervju inbokad',
    'Du har en intervju inbokad för ' || COALESCE(v_job_title, 'en tjänst') || ' den ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Stockholm', 'DD Mon YYYY HH24:MI'),
    jsonb_build_object('job_id', NEW.job_id, 'interview_id', NEW.id, 'route', '/my-applications')
  );

  RETURN NEW;
END;
$$;

-- 7. Update notify_saved_search_matches to check preferences
CREATE OR REPLACE FUNCTION public.notify_saved_search_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  saved_search RECORD;
  matches BOOLEAN;
BEGIN
  IF NEW.is_active = false OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR saved_search IN 
    SELECT * FROM saved_searches
  LOOP
    matches := TRUE;

    IF saved_search.search_query IS NOT NULL AND saved_search.search_query <> '' THEN
      IF NOT (
        LOWER(NEW.title) LIKE '%' || LOWER(saved_search.search_query) || '%' OR
        LOWER(COALESCE(NEW.workplace_city, '')) LIKE '%' || LOWER(saved_search.search_query) || '%'
      ) THEN
        matches := FALSE;
      END IF;
    END IF;

    IF matches AND saved_search.city IS NOT NULL AND saved_search.city <> '' THEN
      IF NOT (
        LOWER(COALESCE(NEW.workplace_city, '')) LIKE '%' || LOWER(saved_search.city) || '%' OR
        LOWER(COALESCE(NEW.workplace_municipality, '')) LIKE '%' || LOWER(saved_search.city) || '%'
      ) THEN
        matches := FALSE;
      END IF;
    END IF;

    IF matches AND saved_search.county IS NOT NULL AND saved_search.county <> '' THEN
      IF NEW.workplace_county <> saved_search.county THEN
        matches := FALSE;
      END IF;
    END IF;

    IF matches AND saved_search.employment_types IS NOT NULL AND array_length(saved_search.employment_types, 1) > 0 THEN
      IF NOT (NEW.employment_type = ANY(saved_search.employment_types)) THEN
        matches := FALSE;
      END IF;
    END IF;

    IF matches AND saved_search.category IS NOT NULL AND saved_search.category <> '' THEN
      IF NEW.category <> saved_search.category THEN
        matches := FALSE;
      END IF;
    END IF;

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

    IF matches THEN
      UPDATE saved_searches
      SET new_matches_count = new_matches_count + 1,
          updated_at = now()
      WHERE id = saved_search.id;

      IF is_notification_enabled(saved_search.user_id, 'saved_search_match') THEN
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
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 8. Add trigger for expired/closed jobs -> notify job seekers
CREATE OR REPLACE FUNCTION public.notify_job_closed_to_applicants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_applicant RECORD;
BEGIN
  IF (OLD.is_active = true AND NEW.is_active = false) 
     OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    
    FOR v_applicant IN 
      SELECT DISTINCT applicant_id FROM job_applications WHERE job_id = NEW.id
    LOOP
      IF is_notification_enabled(v_applicant.applicant_id, 'job_closed') THEN
        INSERT INTO notifications (user_id, type, title, body, metadata)
        VALUES (
          v_applicant.applicant_id,
          'job_closed',
          'Annons avslutad',
          'Tjänsten "' || COALESCE(NEW.title, 'Okänd tjänst') || '" har avslutats.',
          jsonb_build_object('job_id', NEW.id, 'route', '/my-applications')
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_job_closed_notify_applicants
  AFTER UPDATE ON public.job_postings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_closed_to_applicants();
