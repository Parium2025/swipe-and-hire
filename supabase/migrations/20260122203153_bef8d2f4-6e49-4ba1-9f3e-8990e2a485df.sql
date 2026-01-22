-- Add source_type column to distinguish between hr_news and career_tips
ALTER TABLE public.rss_source_health 
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'hr_news';

-- Add columns that the career-tips function expects
ALTER TABLE public.rss_source_health 
ADD COLUMN IF NOT EXISTS last_check_at timestamptz,
ADD COLUMN IF NOT EXISTS total_fetches integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_fetches integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS last_item_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create index for efficient queries by source_type
CREATE INDEX IF NOT EXISTS idx_rss_source_health_source_type ON public.rss_source_health(source_type);