BEGIN;

-- Ta bort anonym läsrättighet på recensions-vyn och tabellen
REVOKE SELECT ON public.company_reviews_public FROM anon;
REVOKE SELECT ON public.company_reviews FROM anon;

-- Ersätt den publika läs policyn med en som bara gäller inloggade
DROP POLICY IF EXISTS "Public can view company reviews" ON public.company_reviews;

CREATE POLICY "Authenticated users can view company reviews"
  ON public.company_reviews FOR SELECT
  TO authenticated
  USING (true);

-- Säkerställ att inloggade och service-roll har rätt behörigheter
GRANT SELECT ON public.company_reviews_public TO authenticated;
GRANT SELECT ON public.company_reviews TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.company_reviews TO authenticated;
GRANT ALL ON public.company_reviews TO service_role;
GRANT ALL ON public.company_reviews_public TO service_role;

COMMIT;