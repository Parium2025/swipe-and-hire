-- Add rating column to my_candidates table
ALTER TABLE public.my_candidates ADD COLUMN rating integer DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);