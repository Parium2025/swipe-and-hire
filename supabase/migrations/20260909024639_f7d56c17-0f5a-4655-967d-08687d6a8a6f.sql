DROP TRIGGER IF EXISTS trg_clear_rejection_on_hire ON public.job_applications;
DROP FUNCTION IF EXISTS public.clear_rejection_on_hire();