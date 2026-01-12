-- Create table for storing device push notification tokens
CREATE TABLE public.device_push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure each token is unique per user
  UNIQUE(user_id, token)
);

-- Create index for fast lookups by user_id
CREATE INDEX idx_device_push_tokens_user_id ON public.device_push_tokens(user_id);
CREATE INDEX idx_device_push_tokens_active ON public.device_push_tokens(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own tokens
CREATE POLICY "Users can view their own push tokens" 
ON public.device_push_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens" 
ON public.device_push_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" 
ON public.device_push_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" 
ON public.device_push_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_device_push_tokens_updated_at
BEFORE UPDATE ON public.device_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();