-- Add missing columns to job_applications
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS availability TEXT;

-- Create support_messages table for ticket replies
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
ON public.support_messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin_reply = true);

CREATE POLICY "Users can create messages"
ON public.support_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);