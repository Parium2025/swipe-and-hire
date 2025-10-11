-- Enable real-time for profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Enable real-time for company_reviews table
ALTER TABLE public.company_reviews REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_reviews;