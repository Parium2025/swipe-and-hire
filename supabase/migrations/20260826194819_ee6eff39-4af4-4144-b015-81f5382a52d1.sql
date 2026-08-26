-- Ömsesidig uteslutning: ett jobb kan vara sparat ELLER skippat, aldrig båda
CREATE OR REPLACE FUNCTION public.enforce_saved_skipped_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'saved_jobs' THEN
    -- Jobb sparat → ta bort ev. "skippad"-markering för samma jobb
    DELETE FROM public.swipe_actions
    WHERE user_id = NEW.user_id
      AND job_id = NEW.job_id
      AND action = 'skipped';
  ELSIF TG_TABLE_NAME = 'swipe_actions' AND NEW.action = 'skipped' THEN
    -- Jobb skippat → ta bort ev. sparning för samma jobb
    DELETE FROM public.saved_jobs
    WHERE user_id = NEW.user_id
      AND job_id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saved_jobs_clear_skip
AFTER INSERT ON public.saved_jobs
FOR EACH ROW EXECUTE FUNCTION public.enforce_saved_skipped_exclusivity();

CREATE TRIGGER trg_swipe_actions_clear_save
AFTER INSERT OR UPDATE ON public.swipe_actions
FOR EACH ROW EXECUTE FUNCTION public.enforce_saved_skipped_exclusivity();

-- Rensa ev. befintliga rader som ligger i båda listorna (sparning vinner)
DELETE FROM public.swipe_actions sa
USING public.saved_jobs sj
WHERE sa.user_id = sj.user_id
  AND sa.job_id = sj.job_id
  AND sa.action = 'skipped';

-- Index för skippade-jobb-frågan: WHERE user_id = ? AND action = 'skipped' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_swipe_actions_user_action_created
ON public.swipe_actions (user_id, action, created_at DESC);