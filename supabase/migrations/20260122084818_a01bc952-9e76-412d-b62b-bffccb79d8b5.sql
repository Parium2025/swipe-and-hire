-- Create table for daily career tips (same structure as daily_hr_news)
CREATE TABLE public.daily_career_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  category TEXT NOT NULL,
  icon_name TEXT,
  gradient TEXT,
  news_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_index INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  is_translated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.daily_career_tips ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (career tips are public content)
CREATE POLICY "Career tips are publicly readable" 
ON public.daily_career_tips 
FOR SELECT 
USING (true);

-- Create index for efficient querying
CREATE INDEX idx_daily_career_tips_published_at 
ON public.daily_career_tips (published_at DESC NULLS LAST);

-- Enable realtime for career tips updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_career_tips;