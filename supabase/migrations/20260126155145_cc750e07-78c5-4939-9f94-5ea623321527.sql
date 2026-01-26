-- Create saved_searches table for storing user search criteria
CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  -- Search criteria
  search_query TEXT,
  city TEXT,
  county TEXT,
  employment_types TEXT[],
  category TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  -- Notification tracking
  new_matches_count INTEGER NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_notified_at TIMESTAMP WITH TIME ZONE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved searches"
ON public.saved_searches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved searches"
ON public.saved_searches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved searches"
ON public.saved_searches FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches"
ON public.saved_searches FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX idx_saved_searches_last_checked ON public.saved_searches(last_checked_at);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for saved_searches (for live badge updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_searches;