CREATE OR REPLACE VIEW public.company_reviews_public AS
SELECT
  r.id,
  r.company_id,
  r.rating,
  r.comment,
  r.is_anonymous,
  r.created_at,
  r.updated_at,
  CASE WHEN r.is_anonymous THEN NULL::uuid ELSE r.user_id END AS user_id
FROM public.company_reviews r;

GRANT SELECT ON public.company_reviews_public TO authenticated;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.company_reviews;

CREATE POLICY "Users can view their own reviews"
ON public.company_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = hidden_author_id);