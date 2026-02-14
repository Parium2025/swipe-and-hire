-- Track which jobs have had auto-close messages sent to candidates
ALTER TABLE public.job_postings 
ADD COLUMN auto_close_notified_at timestamp with time zone DEFAULT NULL;

-- Track which interviews have had follow-up reminders sent to recruiters
ALTER TABLE public.interviews 
ADD COLUMN followup_reminder_sent_at timestamp with time zone DEFAULT NULL;

-- Index for efficient queries on un-notified closed jobs
CREATE INDEX idx_job_postings_auto_close 
ON public.job_postings (is_active, auto_close_notified_at) 
WHERE is_active = false AND auto_close_notified_at IS NULL;