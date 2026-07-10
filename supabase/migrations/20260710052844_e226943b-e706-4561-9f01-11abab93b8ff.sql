
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS subcategories text[],
  ADD COLUMN IF NOT EXISTS time_filter text,
  ADD COLUMN IF NOT EXISTS sort_by text;
