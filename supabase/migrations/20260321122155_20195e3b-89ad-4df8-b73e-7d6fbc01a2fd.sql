-- Enums for the new outreach / messaging system
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_channel') THEN
    CREATE TYPE public.outreach_channel AS ENUM ('chat', 'email', 'push');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_trigger') THEN
    CREATE TYPE public.outreach_trigger AS ENUM ('job_closed', 'interview_scheduled', 'manual_send');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_recipient') THEN
    CREATE TYPE public.outreach_recipient AS ENUM ('candidate', 'employer');
  END IF;
END
$$;

-- Shared updated_at trigger helper for outreach tables
CREATE OR REPLACE FUNCTION public.set_outreach_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Access helper: direct owner or same organization
CREATE OR REPLACE FUNCTION public.can_manage_outreach_scope(
  p_owner_user_id uuid,
  p_organization_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.uid() = p_owner_user_id
    OR (
      p_organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = p_organization_id
          AND ur.is_active = true
      )
    )
  );
$$;

-- Placeholder renderer for templates
CREATE OR REPLACE FUNCTION public.render_outreach_template(
  p_template text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_result text := COALESCE(p_template, '');
  v_key text;
  v_value text;
BEGIN
  FOR v_key, v_value IN
    SELECT key, value
    FROM jsonb_each_text(COALESCE(p_data, '{}'::jsonb))
  LOOP
    v_result := replace(v_result, '{' || v_key || '}', COALESCE(v_value, ''));
  END LOOP;

  RETURN v_result;
END;
$$;

-- Master templates table
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NULL,
  channel public.outreach_channel NOT NULL,
  subject text NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_templates_owner ON public.outreach_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_templates_org ON public.outreach_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_outreach_templates_channel ON public.outreach_templates(channel);

-- Automation rules mapping triggers -> templates + channels
CREATE TABLE IF NOT EXISTS public.outreach_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  trigger public.outreach_trigger NOT NULL,
  channel public.outreach_channel NOT NULL,
  template_id uuid NOT NULL REFERENCES public.outreach_templates(id) ON DELETE CASCADE,
  recipient_type public.outreach_recipient NOT NULL DEFAULT 'candidate',
  is_enabled boolean NOT NULL DEFAULT true,
  delay_minutes integer NOT NULL DEFAULT 0,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_automations_owner ON public.outreach_automations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_automations_trigger_channel ON public.outreach_automations(trigger, channel);
CREATE INDEX IF NOT EXISTS idx_outreach_automations_template ON public.outreach_automations(template_id);

-- Dispatch log for auditability and future analytics
CREATE TABLE IF NOT EXISTS public.outreach_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  automation_id uuid NULL REFERENCES public.outreach_automations(id) ON DELETE SET NULL,
  template_id uuid NULL REFERENCES public.outreach_templates(id) ON DELETE SET NULL,
  trigger public.outreach_trigger NOT NULL,
  channel public.outreach_channel NOT NULL,
  recipient_user_id uuid NULL,
  recipient_email text NULL,
  conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  interview_id uuid NULL REFERENCES public.interviews(id) ON DELETE SET NULL,
  job_id uuid NULL REFERENCES public.job_postings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_dispatch_logs_owner ON public.outreach_dispatch_logs(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_dispatch_logs_trigger ON public.outreach_dispatch_logs(trigger, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_dispatch_logs_job ON public.outreach_dispatch_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_outreach_dispatch_logs_interview ON public.outreach_dispatch_logs(interview_id);

-- Automatic updated_at triggers
DROP TRIGGER IF EXISTS trg_outreach_templates_updated_at ON public.outreach_templates;
CREATE TRIGGER trg_outreach_templates_updated_at
BEFORE UPDATE ON public.outreach_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_outreach_updated_at();

DROP TRIGGER IF EXISTS trg_outreach_automations_updated_at ON public.outreach_automations;
CREATE TRIGGER trg_outreach_automations_updated_at
BEFORE UPDATE ON public.outreach_automations
FOR EACH ROW
EXECUTE FUNCTION public.set_outreach_updated_at();

-- Resolve active automation for a given event and channel
CREATE OR REPLACE FUNCTION public.get_outreach_automation_for_event(
  p_owner_user_id uuid,
  p_trigger public.outreach_trigger,
  p_channel public.outreach_channel
)
RETURNS TABLE (
  automation_id uuid,
  template_id uuid,
  recipient_type public.outreach_recipient,
  subject text,
  body text,
  delay_minutes integer,
  filters jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  ORDER BY oa.created_at ASC
  LIMIT 1;
$$;

-- Enable RLS
ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- outreach_templates policies
DROP POLICY IF EXISTS "Users can view outreach templates in their scope" ON public.outreach_templates;
CREATE POLICY "Users can view outreach templates in their scope"
ON public.outreach_templates
FOR SELECT
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can insert outreach templates in their scope" ON public.outreach_templates;
CREATE POLICY "Users can insert outreach templates in their scope"
ON public.outreach_templates
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can update outreach templates in their scope" ON public.outreach_templates;
CREATE POLICY "Users can update outreach templates in their scope"
ON public.outreach_templates
FOR UPDATE
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id))
WITH CHECK (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can delete outreach templates in their scope" ON public.outreach_templates;
CREATE POLICY "Users can delete outreach templates in their scope"
ON public.outreach_templates
FOR DELETE
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id));

-- outreach_automations policies
DROP POLICY IF EXISTS "Users can view outreach automations in their scope" ON public.outreach_automations;
CREATE POLICY "Users can view outreach automations in their scope"
ON public.outreach_automations
FOR SELECT
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can insert outreach automations in their scope" ON public.outreach_automations;
CREATE POLICY "Users can insert outreach automations in their scope"
ON public.outreach_automations
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can update outreach automations in their scope" ON public.outreach_automations;
CREATE POLICY "Users can update outreach automations in their scope"
ON public.outreach_automations
FOR UPDATE
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id))
WITH CHECK (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can delete outreach automations in their scope" ON public.outreach_automations;
CREATE POLICY "Users can delete outreach automations in their scope"
ON public.outreach_automations
FOR DELETE
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id));

-- outreach_dispatch_logs policies
DROP POLICY IF EXISTS "Users can view outreach logs in their scope" ON public.outreach_dispatch_logs;
CREATE POLICY "Users can view outreach logs in their scope"
ON public.outreach_dispatch_logs
FOR SELECT
TO authenticated
USING (public.can_manage_outreach_scope(owner_user_id, organization_id));

DROP POLICY IF EXISTS "Users can insert outreach logs in their scope" ON public.outreach_dispatch_logs;
CREATE POLICY "Users can insert outreach logs in their scope"
ON public.outreach_dispatch_logs
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_outreach_scope(owner_user_id, organization_id));

-- Migrate legacy employer chat templates into the new system
INSERT INTO public.outreach_templates (
  owner_user_id,
  organization_id,
  name,
  description,
  channel,
  subject,
  body,
  is_active,
  is_default,
  created_at,
  updated_at
)
SELECT
  emt.employer_id,
  public.get_user_organization_id(emt.employer_id),
  emt.title,
  'Migrerad från tidigare meddelandemallar',
  'chat'::public.outreach_channel,
  NULL,
  emt.content,
  true,
  COALESCE(emt.is_default, false),
  emt.created_at,
  emt.updated_at
FROM public.employer_message_templates emt
WHERE NOT EXISTS (
  SELECT 1
  FROM public.outreach_templates ot
  WHERE ot.owner_user_id = emt.employer_id
    AND ot.channel = 'chat'::public.outreach_channel
    AND ot.name = emt.title
    AND ot.body = emt.content
);

-- Seed current job-closed chat automation from legacy default template
INSERT INTO public.outreach_automations (
  owner_user_id,
  organization_id,
  name,
  trigger,
  channel,
  template_id,
  recipient_type,
  is_enabled,
  delay_minutes,
  filters,
  created_at,
  updated_at
)
SELECT
  ot.owner_user_id,
  ot.organization_id,
  'Automatiskt meddelande när annons avslutas',
  'job_closed'::public.outreach_trigger,
  'chat'::public.outreach_channel,
  ot.id,
  'candidate'::public.outreach_recipient,
  true,
  0,
  '{}'::jsonb,
  now(),
  now()
FROM public.outreach_templates ot
WHERE ot.channel = 'chat'::public.outreach_channel
  AND ot.is_default = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.outreach_automations oa
    WHERE oa.owner_user_id = ot.owner_user_id
      AND oa.trigger = 'job_closed'::public.outreach_trigger
      AND oa.channel = 'chat'::public.outreach_channel
  );