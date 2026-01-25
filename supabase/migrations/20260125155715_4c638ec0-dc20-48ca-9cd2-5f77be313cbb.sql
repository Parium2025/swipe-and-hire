-- Create link_previews table for caching URL metadata
CREATE TABLE public.link_previews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  favicon_url TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast URL lookups
CREATE INDEX idx_link_previews_url ON public.link_previews(url);

-- Enable RLS
ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;

-- Everyone can view cached previews (public cache)
CREATE POLICY "Anyone can view link previews"
ON public.link_previews
FOR SELECT
USING (true);

-- Service role can insert/update (edge function)
CREATE POLICY "Service role can manage previews"
ON public.link_previews
FOR ALL
USING (true)
WITH CHECK (true);