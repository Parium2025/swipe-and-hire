-- 1) Log when a candidate applies to one of the employer's jobs
CREATE OR REPLACE FUNCTION public.log_application_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employer uuid;
  v_title text;
BEGIN
  SELECT jp.employer_id, jp.title INTO v_employer, v_title
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_id;

  IF v_employer IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
  VALUES (
    NEW.applicant_id,
    v_employer,
    'application_submitted',
    NULL,
    v_title,
    jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id, 'actor', 'candidate')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_application_submitted ON public.job_applications;
CREATE TRIGGER trg_log_application_submitted
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.log_application_submitted();

-- 2) Log first employer contact per conversation
CREATE OR REPLACE FUNCTION public.log_first_candidate_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_candidate uuid;
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN
    RETURN NEW;
  END IF;

  SELECT c.candidate_id INTO v_candidate
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id AND c.kind = 'job';

  -- only employer-side messages toward a candidate
  IF v_candidate IS NULL OR v_candidate = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.candidate_activities ca
    WHERE ca.applicant_id = v_candidate
      AND ca.activity_type = 'candidate_contacted'
      AND ca.metadata->>'conversation_id' = NEW.conversation_id::text
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.candidate_activities (applicant_id, user_id, activity_type, old_value, new_value, metadata)
  VALUES (
    v_candidate,
    NEW.sender_id,
    'candidate_contacted',
    NULL,
    NULL,
    jsonb_build_object('conversation_id', NEW.conversation_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_first_candidate_contact ON public.conversation_messages;
CREATE TRIGGER trg_log_first_candidate_contact
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.log_first_candidate_contact();