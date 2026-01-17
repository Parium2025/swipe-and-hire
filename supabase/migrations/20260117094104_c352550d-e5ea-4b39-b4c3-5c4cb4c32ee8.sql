-- Add separate default message for video interviews
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS interview_video_default_message text;