CREATE UNIQUE INDEX IF NOT EXISTS interviews_one_active_per_application
  ON public.interviews (application_id)
  WHERE status IN ('pending', 'confirmed');