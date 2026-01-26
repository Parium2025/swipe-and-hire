-- Create table to track unique job views per user
CREATE TABLE public.job_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

-- Enable RLS
ALTER TABLE public.job_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own view history
CREATE POLICY "Users can view their own job views"
ON public.job_views
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own views
CREATE POLICY "Users can record job views"
ON public.job_views
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_job_views_job_user ON public.job_views(job_id, user_id);
CREATE INDEX idx_job_views_job_id ON public.job_views(job_id);

-- Create function to record a view and increment counter atomically
CREATE OR REPLACE FUNCTION public.record_job_view(p_job_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_already_viewed BOOLEAN;
BEGIN
  -- Prevent parameter spoofing
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN FALSE;
  END IF;

  -- Check if already viewed
  SELECT EXISTS (
    SELECT 1 FROM job_views
    WHERE job_id = p_job_id AND user_id = p_user_id
  ) INTO v_already_viewed;

  IF v_already_viewed THEN
    RETURN FALSE; -- Already counted
  END IF;

  -- Insert view record
  INSERT INTO job_views (job_id, user_id)
  VALUES (p_job_id, p_user_id)
  ON CONFLICT (job_id, user_id) DO NOTHING;

  -- Increment views_count only if insert succeeded
  IF FOUND THEN
    UPDATE job_postings
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = p_job_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;