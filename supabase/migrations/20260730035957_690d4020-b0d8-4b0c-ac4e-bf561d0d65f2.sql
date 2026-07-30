CREATE OR REPLACE FUNCTION public.run_data_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count integer;
  v_app_ids uuid[];
  v_conv_ids uuid[];
BEGIN
  BEGIN
    DELETE FROM public.job_views WHERE created_at < now() - interval '12 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('job_views', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('job_views', 0, SQLERRM);
  END;

  BEGIN
    DELETE FROM public.profile_views WHERE viewed_at < now() - interval '12 months';
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

  -- Gamla ansökningar + ALLT som hänger på dem (inga foreign keys finns)
  BEGIN
    SELECT array_agg(id) INTO v_app_ids
    FROM public.job_applications
    WHERE created_at < now() - interval '24 months';

    IF v_app_ids IS NOT NULL AND array_length(v_app_ids, 1) > 0 THEN
      SELECT array_agg(id) INTO v_conv_ids
      FROM public.conversations WHERE application_id = ANY(v_app_ids);

      IF v_conv_ids IS NOT NULL AND array_length(v_conv_ids, 1) > 0 THEN
        DELETE FROM public.conversation_message_reactions
        WHERE message_id IN (SELECT id FROM public.conversation_messages WHERE conversation_id = ANY(v_conv_ids));
        DELETE FROM public.conversation_messages WHERE conversation_id = ANY(v_conv_ids);
        DELETE FROM public.conversation_members WHERE conversation_id = ANY(v_conv_ids);
        DELETE FROM public.conversations WHERE id = ANY(v_conv_ids);
      END IF;

      DELETE FROM public.criterion_results
      WHERE evaluation_id IN (SELECT id FROM public.candidate_evaluations WHERE application_id = ANY(v_app_ids));
      DELETE FROM public.candidate_evaluations WHERE application_id = ANY(v_app_ids);
      DELETE FROM public.candidate_summaries WHERE application_id = ANY(v_app_ids);
      DELETE FROM public.cv_analysis_queue WHERE application_id = ANY(v_app_ids);
      DELETE FROM public.interviews WHERE application_id = ANY(v_app_ids);
      DELETE FROM public.my_candidates WHERE application_id = ANY(v_app_ids);
      DELETE FROM public.profile_views WHERE application_id = ANY(v_app_ids);

      DELETE FROM public.job_applications WHERE id = ANY(v_app_ids);
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
      v_count := 0;
    END IF;

    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('job_applications', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('job_applications', 0, SQLERRM);
  END;

  -- Kandidatanteckningar/betyg/bedömningar som blivit föräldralösa
  BEGIN
    DELETE FROM public.candidate_notes cn
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_applications a WHERE a.applicant_id = cn.applicant_id
    );
    DELETE FROM public.candidate_ratings cr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_applications a WHERE a.applicant_id = cr.applicant_id
    );
    DELETE FROM public.criterion_feedback cf
    WHERE NOT EXISTS (
      SELECT 1 FROM public.candidate_evaluations e WHERE e.id = cf.evaluation_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.data_retention_runs(target_table, deleted_count) VALUES ('orphaned_candidate_data', v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.data_retention_runs(target_table, deleted_count, error_message) VALUES ('orphaned_candidate_data', 0, SQLERRM);
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
$fn$;