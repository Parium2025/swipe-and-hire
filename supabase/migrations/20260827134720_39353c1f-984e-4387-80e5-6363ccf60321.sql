ALTER TABLE public.company_reviews
  ADD COLUMN IF NOT EXISTS public_author_id uuid
  GENERATED ALWAYS AS (CASE WHEN is_anonymous THEN NULL::uuid ELSE user_id END) STORED;

DROP POLICY IF EXISTS "Public can view company reviews" ON public.company_reviews;
CREATE POLICY "Public can view company reviews"
  ON public.company_reviews FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE SELECT ON public.company_reviews FROM anon, authenticated;

GRANT SELECT (id, company_id, rating, comment, is_anonymous, created_at, updated_at, public_author_id)
  ON public.company_reviews TO anon, authenticated;

GRANT ALL ON public.company_reviews TO service_role;

CREATE OR REPLACE VIEW public.company_reviews_public
WITH (security_invoker = true) AS
  SELECT id, company_id, rating, comment, is_anonymous, created_at, updated_at,
         public_author_id AS user_id
  FROM public.company_reviews;

GRANT SELECT ON public.company_reviews_public TO anon, authenticated;