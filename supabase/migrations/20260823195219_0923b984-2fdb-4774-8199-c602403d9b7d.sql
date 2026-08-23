CREATE TABLE IF NOT EXISTS public.criteria_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pause_reason text,
  total_items integer NOT NULL DEFAULT 0,
  done_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.criteria_eval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.criteria_eval_runs(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  application_id uuid,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, applicant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_criteria_eval_active_run
  ON public.criteria_eval_runs (job_id)
  WHERE status IN ('pending', 'running', 'paused');

CREATE INDEX IF NOT EXISTS idx_criteria_eval_items_run_status
  ON public.criteria_eval_items (run_id, status);

CREATE INDEX IF NOT EXISTS idx_criteria_eval_runs_status
  ON public.criteria_eval_runs (status, updated_at);

GRANT SELECT ON public.criteria_eval_runs TO authenticated;
GRANT SELECT ON public.criteria_eval_items TO authenticated;
GRANT ALL ON public.criteria_eval_runs TO service_role;
GRANT ALL ON public.criteria_eval_items TO service_role;

ALTER TABLE public.criteria_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criteria_eval_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view their own eval runs"
  ON public.criteria_eval_runs FOR SELECT TO authenticated
  USING (public.can_view_job_application(job_id));

CREATE POLICY "Employers can view their own eval items"
  ON public.criteria_eval_items FOR SELECT TO authenticated
  USING (public.can_view_job_application(job_id));

CREATE OR REPLACE FUNCTION public.touch_criteria_eval_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criteria_eval_runs_touch ON public.criteria_eval_runs;
CREATE TRIGGER trg_criteria_eval_runs_touch
  BEFORE UPDATE ON public.criteria_eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_criteria_eval_updated_at();

DROP TRIGGER IF EXISTS trg_criteria_eval_items_touch ON public.criteria_eval_items;
CREATE TRIGGER trg_criteria_eval_items_touch
  BEFORE UPDATE ON public.criteria_eval_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_criteria_eval_updated_at();

-- Start (or reuse) a background evaluation run for a job
CREATE OR REPLACE FUNCTION public.start_criteria_eval_run(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_total integer;
BEGIN
  IF NOT public.can_view_job_application(p_job_id) THEN
    RAISE EXCEPTION 'Not authorized for this job';
  END IF;

  SELECT id INTO v_run_id
  FROM public.criteria_eval_runs
  WHERE job_id = p_job_id AND status IN ('pending', 'running', 'paused')
  LIMIT 1;

  IF v_run_id IS NOT NULL THEN
    UPDATE public.criteria_eval_runs
    SET status = 'pending', pause_reason = NULL
    WHERE id = v_run_id AND status = 'paused';
  ELSE
    INSERT INTO public.criteria_eval_runs (job_id, created_by, status)
    VALUES (p_job_id, auth.uid(), 'pending')
    RETURNING id INTO v_run_id;
  END IF;

  INSERT INTO public.criteria_eval_items (run_id, job_id, applicant_id, application_id)
  SELECT v_run_id, a.job_id, a.applicant_id, a.id
  FROM public.job_applications a
  WHERE a.job_id = p_job_id
  ON CONFLICT (run_id, applicant_id) DO NOTHING;

  SELECT count(*) INTO v_total FROM public.criteria_eval_items WHERE run_id = v_run_id;

  UPDATE public.criteria_eval_runs r
  SET total_items = v_total,
      done_items = (SELECT count(*) FROM public.criteria_eval_items i WHERE i.run_id = v_run_id AND i.status = 'done'),
      failed_items = (SELECT count(*) FROM public.criteria_eval_items i WHERE i.run_id = v_run_id AND i.status = 'failed')
  WHERE r.id = v_run_id;

  RETURN v_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_criteria_eval_run(uuid) TO authenticated;

-- Claim one run for this worker invocation (single-flight lease)
CREATE OR REPLACE FUNCTION public.claim_criteria_eval_run(p_lease_seconds integer DEFAULT 120)
RETURNS TABLE (run_id uuid, job_id uuid, created_by uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.criteria_eval_runs r
  SET status = 'running',
      lease_until = now() + make_interval(secs => p_lease_seconds)
  WHERE r.id = (
    SELECT c.id
    FROM public.criteria_eval_runs c
    WHERE c.status IN ('pending', 'running')
      AND (c.lease_until IS NULL OR c.lease_until < now())
    ORDER BY c.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id, r.job_id, r.created_by;
END;
$$;

-- Claim a bounded batch of queue items
CREATE OR REPLACE FUNCTION public.claim_criteria_eval_items(p_run_id uuid, p_limit integer DEFAULT 8)
RETURNS TABLE (item_id uuid, applicant_id uuid, application_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.criteria_eval_items i
  SET status = 'processing', attempts = i.attempts + 1
  WHERE i.id IN (
    SELECT c.id
    FROM public.criteria_eval_items c
    WHERE c.run_id = p_run_id
      AND (c.status = 'pending' OR (c.status = 'processing' AND c.updated_at < now() - interval '5 minutes'))
      AND c.attempts < 3
    ORDER BY c.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING i.id, i.applicant_id, i.application_id;
END;
$$;

-- Mark an item done or failed and refresh run counters
CREATE OR REPLACE FUNCTION public.finish_criteria_eval_item(p_item_id uuid, p_ok boolean, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  UPDATE public.criteria_eval_items
  SET status = CASE WHEN p_ok THEN 'done' WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
      error = CASE WHEN p_ok THEN NULL ELSE p_error END
  WHERE id = p_item_id
  RETURNING run_id INTO v_run_id;

  IF v_run_id IS NULL THEN RETURN; END IF;

  UPDATE public.criteria_eval_runs r
  SET done_items = (SELECT count(*) FROM public.criteria_eval_items i WHERE i.run_id = v_run_id AND i.status = 'done'),
      failed_items = (SELECT count(*) FROM public.criteria_eval_items i WHERE i.run_id = v_run_id AND i.status = 'failed')
  WHERE r.id = v_run_id;

  UPDATE public.criteria_eval_runs r
  SET status = 'completed', finished_at = now(), lease_until = NULL
  WHERE r.id = v_run_id
    AND r.status = 'running'
    AND NOT EXISTS (
      SELECT 1 FROM public.criteria_eval_items i
      WHERE i.run_id = v_run_id AND i.status IN ('pending', 'processing')
    );
END;
$$;

-- Pause a run (credits exhausted, blocked by policy, or repeated rate limits)
CREATE OR REPLACE FUNCTION public.pause_criteria_eval_run(p_run_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.criteria_eval_runs
  SET status = 'paused', pause_reason = p_reason, lease_until = NULL
  WHERE id = p_run_id;

  UPDATE public.criteria_eval_items
  SET status = 'pending'
  WHERE run_id = p_run_id AND status = 'processing';
END;
$$;

-- Release the lease without finishing the run (more work remains)
CREATE OR REPLACE FUNCTION public.release_criteria_eval_run(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.criteria_eval_runs
  SET lease_until = NULL
  WHERE id = p_run_id AND status = 'running';
END;
$$;

-- Let the employer cancel an ongoing run
CREATE OR REPLACE FUNCTION public.cancel_criteria_eval_run(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  SELECT job_id INTO v_job_id FROM public.criteria_eval_runs WHERE id = p_run_id;
  IF v_job_id IS NULL OR NOT public.can_view_job_application(v_job_id) THEN
    RAISE EXCEPTION 'Not authorized for this run';
  END IF;

  UPDATE public.criteria_eval_runs
  SET status = 'cancelled', finished_at = now(), lease_until = NULL
  WHERE id = p_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_criteria_eval_run(uuid) TO authenticated;