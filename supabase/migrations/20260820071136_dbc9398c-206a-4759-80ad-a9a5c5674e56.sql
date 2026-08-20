CREATE OR REPLACE FUNCTION public.get_outreach_automation_for_event(p_owner_user_id uuid, p_trigger outreach_trigger, p_channel outreach_channel)
 RETURNS TABLE(automation_id uuid, template_id uuid, recipient_type outreach_recipient, subject text, body text, delay_minutes integer, filters jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    oa.id AS automation_id,
    ot.id AS template_id,
    oa.recipient_type,
    ot.subject,
    ot.body,
    oa.delay_minutes,
    oa.filters
  FROM public.outreach_automations oa
  JOIN public.outreach_templates ot ON ot.id = oa.template_id
  WHERE oa.owner_user_id = p_owner_user_id
    AND oa.trigger = p_trigger
    AND oa.channel = p_channel
    AND oa.is_enabled = true
    AND ot.is_active = true
  ORDER BY oa.created_at DESC
  LIMIT 1;
$function$;