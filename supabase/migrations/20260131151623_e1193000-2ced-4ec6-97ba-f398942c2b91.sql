-- Remove the unique constraint to allow multiple reviews per user per company
ALTER TABLE public.company_reviews 
DROP CONSTRAINT IF EXISTS unique_user_company_review;