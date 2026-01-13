-- =====================================================
-- CONVERSATION & MESSAGING SYSTEM
-- Supports: 1-1 messages, group chats, optional job linking
-- =====================================================

-- Table for conversations (both 1-1 and group)
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT, -- NULL for 1-1 chats, set for group chats
  is_group BOOLEAN NOT NULL DEFAULT false,
  job_id UUID REFERENCES public.job_postings(id) ON DELETE SET NULL, -- Optional job link
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now() -- For sorting
);

-- Table for conversation members
CREATE TABLE public.conversation_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_admin BOOLEAN NOT NULL DEFAULT false, -- For group management
  UNIQUE(conversation_id, user_id)
);

-- Table for conversation messages (replacing/extending messages for new system)
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_system_message BOOLEAN NOT NULL DEFAULT false -- For "X joined the group" etc
);

-- Indexes for performance
CREATE INDEX idx_conversations_created_by ON public.conversations(created_by);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_conversation ON public.conversation_members(conversation_id);
CREATE INDEX idx_conversation_messages_conversation ON public.conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created ON public.conversation_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS for conversations: users can see conversations they're members of
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversations.id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversation creators can update"
ON public.conversations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversations.id
    AND cm.user_id = auth.uid()
    AND (cm.is_admin = true OR conversations.created_by = auth.uid())
  )
);

-- RLS for members: users can see members of their conversations
CREATE POLICY "Users can view conversation members"
ON public.conversation_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members my_membership
    WHERE my_membership.conversation_id = conversation_members.conversation_id
    AND my_membership.user_id = auth.uid()
  )
);

CREATE POLICY "Conversation admins can add members"
ON public.conversation_members FOR INSERT
WITH CHECK (
  -- Either creating own membership when creating conversation
  (user_id = auth.uid())
  OR
  -- Or is admin of the conversation
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
    AND cm.is_admin = true
  )
);

CREATE POLICY "Members can update their own membership"
ON public.conversation_members FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
ON public.conversation_members FOR DELETE
USING (
  user_id = auth.uid() -- Can leave themselves
  OR
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
    AND cm.is_admin = true
  )
);

-- RLS for messages: members can see and send messages
CREATE POLICY "Members can view conversation messages"
ON public.conversation_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_messages.conversation_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send messages"
ON public.conversation_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_messages.conversation_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Senders can update their messages"
ON public.conversation_messages FOR UPDATE
USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete their messages"
ON public.conversation_messages FOR DELETE
USING (auth.uid() = sender_id);

-- Trigger to update conversation's last_message_at
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_new_message_update_conversation
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;