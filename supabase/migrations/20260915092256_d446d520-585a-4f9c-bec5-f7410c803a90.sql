CREATE OR REPLACE FUNCTION public.upsert_outreach_templates_atomic(
  p_owner_user_id uuid,
  p_organization_id uuid,
  p_trigger text,
  p_templates jsonb
)
RETURNS TABLE (id uuid, channel public.outreach_channel)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template jsonb;
  v_channel public.outreach_channel;
  v_name text;
  v_subject text;
  v_body text;
  v_existing_id uuid;
  v_result_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_owner_user_id THEN
    RAISE EXCEPTION 'Du får endast spara egna mallar' USING ERRCODE = '42501';
  END IF;

  FOR v_template IN SELECT * FROM jsonb_array_elements(p_templates)
  LOOP
    v_channel := (v_template->>'channel')::public.outreach_channel;
    v_name := v_template->>'name';
    v_subject := NULLIF(v_template->>'subject', '');
    v_body := v_template->>'body';

    IF v_name IS NULL OR v_body IS NULL OR v_channel IS NULL THEN
      RAISE EXCEPTION 'Ogiltig mall: namn, kanal och innehåll krävs' USING ERRCODE = '22004';
    END IF;

    SELECT t.id INTO v_existing_id
    FROM public.outreach_templates t
    WHERE t.owner_user_id = p_owner_user_id
      AND t.trigger = p_trigger::public.outreach_trigger
      AND t.channel = v_channel
      AND t.is_default = false
    ORDER BY t.created_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.outreach_templates
      SET name = v_name,
          subject = v_subject,
          body = v_body,
          is_active = true,
          updated_at = now()
      WHERE id = v_existing_id
      RETURNING id INTO v_result_id;
    ELSE
      INSERT INTO public.outreach_templates (
        owner_user_id,
        organization_id,
        name,
        channel,
        trigger,
        subject,
        body,
        is_active,
        is_default
      )
      VALUES (
        p_owner_user_id,
        p_organization_id,
        v_name,
        v_channel,
        p_trigger::public.outreach_trigger,
        v_subject,
        v_body,
        true,
        false
      )
      RETURNING id INTO v_result_id;
    END IF;

    id := v_result_id;
    channel := v_channel;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_outreach_templates_atomic(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_outreach_templates_atomic(uuid, uuid, text, jsonb) TO service_role;