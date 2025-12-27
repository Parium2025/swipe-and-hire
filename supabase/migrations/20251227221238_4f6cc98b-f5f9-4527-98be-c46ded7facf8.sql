-- Create CV analysis queue table
CREATE TABLE public.cv_analysis_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL,
  application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
  cv_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cv_analysis_queue ENABLE ROW LEVEL SECURITY;

-- Index for efficient queue processing
CREATE INDEX idx_cv_queue_status_priority ON public.cv_analysis_queue (status, priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_cv_queue_applicant ON public.cv_analysis_queue (applicant_id);
CREATE INDEX idx_cv_queue_application ON public.cv_analysis_queue (application_id) WHERE application_id IS NOT NULL;

-- Policy: Service role can manage queue (edge functions use service role)
CREATE POLICY "Service role can manage queue"
ON public.cv_analysis_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to add CV to analysis queue (prevents duplicates)
CREATE OR REPLACE FUNCTION public.queue_cv_analysis(
  p_applicant_id UUID,
  p_cv_url TEXT,
  p_application_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_priority INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Check if already queued or completed for this application
  IF p_application_id IS NOT NULL THEN
    SELECT id INTO v_queue_id
    FROM cv_analysis_queue
    WHERE application_id = p_application_id
      AND status IN ('pending', 'processing', 'completed')
    LIMIT 1;
    
    IF v_queue_id IS NOT NULL THEN
      RETURN v_queue_id; -- Already in queue
    END IF;
  END IF;
  
  -- Check if summary already exists
  IF p_job_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM candidate_summaries
      WHERE applicant_id = p_applicant_id
        AND job_id = p_job_id
    ) THEN
      RETURN NULL; -- Summary already exists
    END IF;
  END IF;
  
  -- Insert into queue
  INSERT INTO cv_analysis_queue (applicant_id, application_id, job_id, cv_url, priority)
  VALUES (p_applicant_id, p_application_id, p_job_id, p_cv_url, p_priority)
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;

-- Function to get next batch of CVs to process
CREATE OR REPLACE FUNCTION public.get_cv_queue_batch(p_batch_size INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  applicant_id UUID,
  application_id UUID,
  job_id UUID,
  cv_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE cv_analysis_queue q
  SET 
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  WHERE q.id IN (
    SELECT cq.id
    FROM cv_analysis_queue cq
    WHERE cq.status = 'pending'
      AND cq.attempts < cq.max_attempts
    ORDER BY cq.priority DESC, cq.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id, q.applicant_id, q.application_id, q.job_id, q.cv_url;
END;
$$;

-- Function to mark queue item as completed
CREATE OR REPLACE FUNCTION public.complete_cv_analysis(
  p_queue_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cv_analysis_queue
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    completed_at = now(),
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_queue_id;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_cv_queue_updated_at
BEFORE UPDATE ON public.cv_analysis_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();