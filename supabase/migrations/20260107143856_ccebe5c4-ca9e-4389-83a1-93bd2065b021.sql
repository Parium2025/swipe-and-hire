-- Add image_url column to daily_hr_news for article images
ALTER TABLE public.daily_hr_news 
ADD COLUMN IF NOT EXISTS image_url TEXT;