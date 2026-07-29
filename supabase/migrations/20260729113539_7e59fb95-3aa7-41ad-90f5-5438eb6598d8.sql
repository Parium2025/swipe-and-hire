
CREATE TABLE IF NOT EXISTS public.data_retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  target_table text NOT NULL,
  deleted_count integer NOT NULL DEFAULT 0,
  error_message text
);

GRANT ALL ON public.data_retention_runs TO service_role;
GRANT SELECT ON public.data_retention_runs TO authenticated;

ALTER TABLE public.data_retention_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'data_retention_runs'
      AND policyname = 'Platform admins can view retention runs'
  ) THEN
    CREATE POLICY "Platform admins can view retention runs"
      ON public.data_retention_runs FOR SELECT TO authenticated
      USING (public.is_platform_admin(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.run_data_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  BEGIN
    DELETE FROM public.job_views WHERE created_at < now() - interval '12 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('job_views', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('job_views', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.profile_views WHERE created_at < now() - interval '12 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('profile_views', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('profile_views', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.notifications WHERE created_at < now() - interval '6 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('notifications', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('notifications', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.candidate_activities WHERE created_at < now() - interval '24 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('candidate_activities', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('candidate_activities', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.conversations c
    WHERE c.application_id IN (
      SELECT a.id FROM public.job_applications a WHERE a.created_at < now() - interval '24 months'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('conversations', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('conversations', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.job_applications WHERE created_at < now() - interval '24 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('job_applications', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('job_applications', 0, SQLERRM);
  END;

  DELETE FROM public.data_retention_runs WHERE ran_at < now() - interval '12 months';
END;
$$;

SELECT cron.unschedule('data-retention-nightly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'data-retention-nightly');

SELECT cron.schedule('data-retention-nightly', '30 3 * * *', $cron$ SELECT public.run_data_retention(); $cron$);
