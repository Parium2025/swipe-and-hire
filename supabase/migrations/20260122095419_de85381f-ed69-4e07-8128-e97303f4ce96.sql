-- Create table to track RSS source health
CREATE TABLE public.rss_source_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_error_message TEXT,
  total_successes INTEGER NOT NULL DEFAULT 0,
  total_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rss_source_health ENABLE ROW LEVEL SECURITY;

-- Only service role can manage health records
CREATE POLICY "Service role can manage rss health" 
ON public.rss_source_health 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Anyone can view health status (for admin dashboards)
CREATE POLICY "Anyone can view rss health" 
ON public.rss_source_health 
FOR SELECT 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_rss_source_health_updated_at
BEFORE UPDATE ON public.rss_source_health
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();