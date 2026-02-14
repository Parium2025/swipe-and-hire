
-- Notifications table for both employers and job seekers
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'new_application', 'application_status', 'interview_scheduled', 'interview_response', 'message', 'job_expired', 'saved_search_match'
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can insert (from triggers/functions)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify employer when new application is received
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
  -- Get job info
  SELECT title, employer_id INTO v_job_title, v_employer_id
  FROM job_postings WHERE id = NEW.job_id;

  -- Build applicant name
  v_applicant_name := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
  v_applicant_name := TRIM(v_applicant_name);
  IF v_applicant_name = '' THEN v_applicant_name := 'En kandidat'; END IF;

  -- Create notification for employer
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

CREATE TRIGGER on_new_application_notify
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_application();

-- Trigger: notify job seeker when application status changes
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_job_title TEXT;
  v_status_label TEXT;
BEGIN
  -- Only fire on status change
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;

  -- Map status to Swedish label
  v_status_label := CASE NEW.status
    WHEN 'interview' THEN 'Intervju bokad'
    WHEN 'hired' THEN 'Anställd'
    WHEN 'rejected' THEN 'Nekad'
    ELSE 'Uppdaterad'
  END;

  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (
    NEW.applicant_id,
    'application_status',
    'Ansökan uppdaterad',
    'Din ansökan till ' || COALESCE(v_job_title, 'en tjänst') || ' har statusen: ' || v_status_label,
    jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id, 'status', NEW.status, 'route', '/my-applications')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_application_status_change_notify
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_application_status_change();

-- Trigger: notify when interview is scheduled
CREATE OR REPLACE FUNCTION public.notify_interview_scheduled()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_job_title TEXT;
BEGIN
  SELECT title INTO v_job_title FROM job_postings WHERE id = NEW.job_id;

  -- Notify the candidate
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

CREATE TRIGGER on_interview_scheduled_notify
  AFTER INSERT ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_interview_scheduled();
