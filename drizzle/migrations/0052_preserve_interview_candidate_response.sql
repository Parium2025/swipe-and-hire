ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS candidate_response text
  CHECK (candidate_response IN ('confirmed','declined'));

CREATE OR REPLACE FUNCTION public.track_interview_candidate_response()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('confirmed','declined') THEN
    NEW.candidate_response := NEW.status;
  ELSIF NEW.status = 'pending' THEN
    -- Ombokning nollställer svaret; kandidaten måste svara på nytt.
    NEW.candidate_response := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_track_interview_candidate_response ON public.interviews;
CREATE TRIGGER trg_track_interview_candidate_response
BEFORE INSERT OR UPDATE OF status ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.track_interview_candidate_response();

-- Befintliga svar
UPDATE public.interviews SET candidate_response = status WHERE status IN ('confirmed','declined');
UPDATE public.interviews i SET candidate_response = CASE WHEN n.title ILIKE '%bekräft%' THEN 'confirmed' ELSE 'declined' END
FROM (
  SELECT DISTINCT ON ((metadata->>'interview_id')) (metadata->>'interview_id')::uuid AS iid, title
  FROM public.notifications
  WHERE type = 'interview_response' AND metadata ? 'interview_id'
  ORDER BY (metadata->>'interview_id'), created_at DESC
) n
WHERE i.id = n.iid AND i.status = 'completed' AND i.candidate_response IS NULL;