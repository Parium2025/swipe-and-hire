-- Add is_translated column to track translated articles
ALTER TABLE public.daily_hr_news 
ADD COLUMN IF NOT EXISTS is_translated boolean DEFAULT false;