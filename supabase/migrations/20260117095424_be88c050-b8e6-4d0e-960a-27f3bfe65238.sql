-- Add video meeting link field for employers
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS interview_video_link text;