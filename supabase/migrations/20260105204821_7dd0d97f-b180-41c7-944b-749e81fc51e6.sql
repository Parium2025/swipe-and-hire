-- Create table for daily HR news
CREATE TABLE public.daily_hr_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  category TEXT NOT NULL, -- e.g. 'hr_tech', 'trends', 'international', 'leadership'
  icon_name TEXT, -- lucide icon name
  gradient TEXT, -- tailwind gradient classes
  news_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_hr_news ENABLE ROW LEVEL SECURITY;

-- Public read access (news is public content)
CREATE POLICY "Anyone can view daily HR news"
ON public.daily_hr_news
FOR SELECT
USING (true);

-- Only service role can insert/update (edge function will handle this)
CREATE POLICY "Service role can manage news"
ON public.daily_hr_news
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create index for fast date lookups
CREATE INDEX idx_daily_hr_news_date ON public.daily_hr_news(news_date);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_hr_news_updated_at
BEFORE UPDATE ON public.daily_hr_news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();