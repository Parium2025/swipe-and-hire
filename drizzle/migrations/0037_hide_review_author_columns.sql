-- Omdömen är publika, men författaren ska vara skyddad när omdömet är anonymt.
-- Läsning av författarkolumnerna stängs därför på kolumnnivå; appen läser
-- via vyn company_reviews_public som bara exponerar public_author_id.
REVOKE SELECT ON public.company_reviews FROM authenticated;
GRANT SELECT (id, company_id, rating, comment, is_anonymous, created_at, updated_at, public_author_id)
  ON public.company_reviews TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_reviews TO authenticated;
GRANT ALL ON public.company_reviews TO service_role;