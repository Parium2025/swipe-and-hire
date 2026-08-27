ALTER PUBLICATION supabase_realtime DROP TABLE public.company_reviews;
ALTER TABLE public.company_reviews REPLICA IDENTITY DEFAULT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_reviews (id, company_id, rating, is_anonymous, created_at, updated_at);