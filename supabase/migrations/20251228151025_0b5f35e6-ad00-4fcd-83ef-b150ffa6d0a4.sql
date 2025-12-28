-- Create table for user-specific stage settings
CREATE TABLE public.user_stage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stage_key text NOT NULL, -- 'to_contact', 'interview', 'offer', 'hired'
  custom_label text, -- null = use default
  color text, -- hex color like '#10B981'
  icon_name text, -- lucide icon name like 'phone', 'calendar'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, stage_key)
);

-- Enable RLS
ALTER TABLE public.user_stage_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users can view their own stage settings"
  ON public.user_stage_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stage settings"
  ON public.user_stage_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stage settings"
  ON public.user_stage_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stage settings"
  ON public.user_stage_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_stage_settings_updated_at
  BEFORE UPDATE ON public.user_stage_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();