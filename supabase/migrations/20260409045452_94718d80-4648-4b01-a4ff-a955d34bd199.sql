
-- Create enum for swipe action types
CREATE TYPE public.swipe_action_type AS ENUM ('skipped', 'liked', 'applied');

-- Create swipe_actions table
CREATE TABLE public.swipe_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  action swipe_action_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

-- Enable RLS
ALTER TABLE public.swipe_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own swipe actions"
ON public.swipe_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own swipe actions"
ON public.swipe_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own swipe actions"
ON public.swipe_actions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own swipe actions"
ON public.swipe_actions FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_swipe_actions_user_id ON public.swipe_actions(user_id);
CREATE INDEX idx_swipe_actions_user_job ON public.swipe_actions(user_id, job_id);
