-- Add columns to support custom stages
ALTER TABLE public.user_stage_settings 
ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_user_stage_settings_order ON public.user_stage_settings(user_id, order_index);