-- Add application_id to conversations to link each conversation to a specific job application
ALTER TABLE public.conversations
ADD COLUMN application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL;

-- Add profile snapshot fields to job_applications to freeze profile data at application time
ALTER TABLE public.job_applications
ADD COLUMN profile_image_snapshot_url text,
ADD COLUMN video_snapshot_url text;

-- Create index for faster lookups
CREATE INDEX idx_conversations_application_id ON public.conversations(application_id);

-- Comment explaining the purpose
COMMENT ON COLUMN public.conversations.application_id IS 'Links conversation to specific job application. Profile shown in conversation is frozen from this application.';
COMMENT ON COLUMN public.job_applications.profile_image_snapshot_url IS 'Snapshot of profile image URL at time of application';
COMMENT ON COLUMN public.job_applications.video_snapshot_url IS 'Snapshot of profile video URL at time of application';