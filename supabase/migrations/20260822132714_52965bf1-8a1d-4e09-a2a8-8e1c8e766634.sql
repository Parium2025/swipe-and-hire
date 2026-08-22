
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_kind') THEN
    CREATE TYPE public.conversation_kind AS ENUM ('job', 'internal');
  END IF;
END $$;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS kind public.conversation_kind NOT NULL DEFAULT 'job',
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_kind ON public.conversations (kind);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON public.conversations (organization_id) WHERE organization_id IS NOT NULL;

-- Alla befintliga samtal är jobbchattar
UPDATE public.conversations SET kind = 'job' WHERE kind IS DISTINCT FROM 'job';

-- Interna samtal måste ha organisation, jobbsamtal får inte ha det
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_internal_requires_org;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_internal_requires_org
  CHECK ((kind = 'internal' AND organization_id IS NOT NULL) OR (kind = 'job' AND organization_id IS NULL));

-- Skapande av interna samtal: bara i egen organisation
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    kind = 'job'
    OR organization_id = public.get_user_organization_id(auth.uid())
  )
);

-- Endast medlemmar i samma organisation får läggas till i interna samtal
CREATE OR REPLACE FUNCTION public.enforce_internal_conversation_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.conversation_kind;
  v_org uuid;
BEGIN
  SELECT kind, organization_id INTO v_kind, v_org
  FROM public.conversations WHERE id = NEW.conversation_id;

  IF v_kind = 'internal' THEN
    IF v_org IS NULL OR public.get_user_organization_id(NEW.user_id) IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Endast medlemmar i organisationen kan delta i interna samtal';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_internal_conversation_membership ON public.conversation_members;
CREATE TRIGGER trg_enforce_internal_conversation_membership
BEFORE INSERT ON public.conversation_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_internal_conversation_membership();
