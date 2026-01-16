-- Add interview settings fields to profiles table
-- These will be used as default values when booking interviews

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS interview_default_message TEXT,
ADD COLUMN IF NOT EXISTS interview_office_address TEXT,
ADD COLUMN IF NOT EXISTS interview_office_instructions TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.interview_default_message IS 'Default message template for interview invitations';
COMMENT ON COLUMN public.profiles.interview_office_address IS 'Default office address for in-person interviews';
COMMENT ON COLUMN public.profiles.interview_office_instructions IS 'Additional instructions for candidates visiting the office (e.g., parking, entrance)';