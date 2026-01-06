-- Add published_at column to store article publication time
ALTER TABLE public.daily_hr_news 
ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;