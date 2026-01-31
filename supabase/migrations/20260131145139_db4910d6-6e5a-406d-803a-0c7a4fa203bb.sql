-- Lägg till unique constraint för att förhindra flera recensioner per användare/företag
ALTER TABLE public.company_reviews 
ADD CONSTRAINT unique_user_company_review UNIQUE (user_id, company_id);

-- Lägg till trigger för automatisk updated_at
DROP TRIGGER IF EXISTS update_company_reviews_updated_at ON public.company_reviews;
CREATE TRIGGER update_company_reviews_updated_at
BEFORE UPDATE ON public.company_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();