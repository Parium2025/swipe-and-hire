-- Create candidate_activities table for tracking rating changes and notes
CREATE TABLE public.candidate_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'rating_changed', 'note_added', 'note_edited'
  old_value TEXT, -- For rating: previous rating, for notes: previous note content
  new_value TEXT, -- For rating: new rating, for notes: new note content
  metadata JSONB, -- Additional context (job_id, etc.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_activities ENABLE ROW LEVEL SECURITY;

-- Employers can view activities for candidates who applied to their jobs or org jobs
CREATE POLICY "Employers can view candidate activities"
ON public.candidate_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = candidate_activities.applicant_id
    AND can_view_job_application(ja.job_id)
  )
);

-- Employers can create activities for candidates they have access to
CREATE POLICY "Employers can create activities"
ON public.candidate_activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = candidate_activities.applicant_id
    AND can_view_job_application(ja.job_id)
  )
);

-- Create index for faster queries
CREATE INDEX idx_candidate_activities_applicant ON public.candidate_activities(applicant_id, created_at DESC);