-- Add candidate_id to conversations for unified per-candidate threads
-- application_id will now represent the CURRENT job context (not the only one)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS candidate_id uuid;

-- Create index for faster lookups by candidate
CREATE INDEX IF NOT EXISTS idx_conversations_candidate_id ON public.conversations(candidate_id);

-- Comment to clarify the new column usage
COMMENT ON COLUMN public.conversations.candidate_id IS 'The job seeker user ID - one conversation per candidate';
COMMENT ON COLUMN public.conversations.application_id IS 'The current job application context - updates when switching jobs';