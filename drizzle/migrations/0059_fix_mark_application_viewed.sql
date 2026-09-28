CREATE OR REPLACE FUNCTION public.mark_application_viewed(p_application_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- can_view_job_application tar ett ANNONS-id, inte ett ansöknings-id.
  SELECT job_id INTO v_job_id FROM public.job_applications WHERE id = p_application_id;
  IF v_job_id IS NULL OR NOT public.can_view_job_application(v_job_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.job_application_views (application_id, viewer_id)
  VALUES (p_application_id, auth.uid())
  ON CONFLICT (application_id, viewer_id) DO NOTHING;

  UPDATE public.job_applications
  SET viewed_at = now()
  WHERE id = p_application_id AND viewed_at IS NULL;
END;
$function$;