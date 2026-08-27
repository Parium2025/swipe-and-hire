-- 1) Publik läsning av omdömen på bastabellen (rader), utan känsliga kolumner
CREATE POLICY "Anyone can view company reviews"
ON public.company_reviews
FOR SELECT
TO anon, authenticated
USING (true);

-- 2) Kolumnnivå: dölj hidden_author_id helt för klienter
REVOKE SELECT ON public.company_reviews FROM anon, authenticated;
GRANT SELECT (id, company_id, user_id, rating, comment, is_anonymous, created_at, updated_at)
  ON public.company_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_reviews TO authenticated;
GRANT ALL ON public.company_reviews TO service_role;

-- 3) Vyn körs nu som anropande användare (security invoker) i stället för definer
DROP VIEW IF EXISTS public.company_reviews_public;
CREATE VIEW public.company_reviews_public
WITH (security_invoker = true) AS
SELECT
  id,
  company_id,
  rating,
  comment,
  is_anonymous,
  created_at,
  updated_at,
  CASE WHEN is_anonymous THEN NULL::uuid ELSE user_id END AS user_id
FROM public.company_reviews;

GRANT SELECT ON public.company_reviews_public TO anon, authenticated;
GRANT ALL ON public.company_reviews_public TO service_role;