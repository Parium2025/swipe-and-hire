-- Add new outreach trigger values for the simpler timeline model
ALTER TYPE public.outreach_trigger ADD VALUE IF NOT EXISTS 'application_received';
ALTER TYPE public.outreach_trigger ADD VALUE IF NOT EXISTS 'application_no_response_14d';
ALTER TYPE public.outreach_trigger ADD VALUE IF NOT EXISTS 'interview_before';
ALTER TYPE public.outreach_trigger ADD VALUE IF NOT EXISTS 'interview_after';