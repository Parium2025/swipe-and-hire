ALTER TABLE public.outreach_templates
  ADD COLUMN IF NOT EXISTS trigger public.outreach_trigger;

CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_templates_slot
  ON public.outreach_templates (owner_user_id, trigger, channel)
  WHERE is_default = false AND trigger IS NOT NULL;