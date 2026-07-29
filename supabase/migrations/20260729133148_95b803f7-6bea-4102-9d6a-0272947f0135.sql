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

  BEGIN
    DELETE FROM public.support_messages m
    WHERE m.ticket_id IN (
      SELECT t.id FROM public.support_tickets t WHERE t.updated_at < now() - interval '24 months'
    );
    DELETE FROM public.support_tickets WHERE updated_at < now() - interval '24 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('support_tickets', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('support_tickets', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.email_send_log WHERE created_at < now() - interval '24 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('email_send_log', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('email_send_log', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.ai_usage_log WHERE created_at < now() - interval '24 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('ai_usage_log', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('ai_usage_log', 0, SQLERRM);
  END;

  DELETE FROM public.data_retention_runs WHERE ran_at < now() - interval '12 months';
END;
$$;