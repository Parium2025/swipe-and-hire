-- 1) Blockeringstabell
CREATE TABLE IF NOT EXISTS public.conversation_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT conversation_blocks_unique UNIQUE (blocker_id, blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.conversation_blocks TO authenticated;
GRANT ALL ON public.conversation_blocks TO service_role;

ALTER TABLE public.conversation_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
  ON public.conversation_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create their own blocks"
  ON public.conversation_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can remove their own blocks"
  ON public.conversation_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_conversation_blocks_blocked ON public.conversation_blocks (blocked_id);

-- 2) Hjälpfunktion: finns blockering i någon riktning?
CREATE OR REPLACE FUNCTION public.is_blocked_pair(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

-- 3) Spärr: meddelanden kan aldrig sparas om blockering finns
CREATE OR REPLACE FUNCTION public.enforce_conversation_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_system_message THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    JOIN public.conversation_blocks cb
      ON (cb.blocker_id = cm.user_id AND cb.blocked_id = NEW.sender_id)
      OR (cb.blocked_id = cm.user_id AND cb.blocker_id = NEW.sender_id)
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'CONVERSATION_BLOCKED'
      USING HINT = 'Meddelandet kan inte levereras eftersom en av parterna har blockerat den andra.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_conversation_block ON public.conversation_messages;
CREATE TRIGGER trg_enforce_conversation_block
  BEFORE INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conversation_block();

-- 4) Realtidssynk för medlemsrader (oläst, tystning, borttagning)
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;

-- 5) Prestandaindex för stora datamängder
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_conversation_messages_content_trgm
  ON public.conversation_messages USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_conv
  ON public.conversation_members (user_id, conversation_id);