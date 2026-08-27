DROP POLICY IF EXISTS "Anyone can view company reviews" ON public.company_reviews;

REVOKE SELECT ON public.company_reviews FROM anon;

ALTER VIEW public.company_reviews_public SET (security_invoker = false);

GRANT SELECT ON public.company_reviews_public TO anon, authenticated;