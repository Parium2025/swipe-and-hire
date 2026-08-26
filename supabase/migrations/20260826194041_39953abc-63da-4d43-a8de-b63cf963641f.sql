-- 1) Trigga sparade sökningar även när ett jobb publiceras från utkast eller återaktiveras
CREATE TRIGGER on_job_activated_check_saved_searches
AFTER UPDATE OF is_active, deleted_at ON public.job_postings
FOR EACH ROW
WHEN (NEW.is_active = true AND NEW.deleted_at IS NULL AND (OLD.is_active = false OR OLD.deleted_at IS NOT NULL))
EXECUTE FUNCTION public.notify_saved_search_matches();

-- 2) Trigram-index för ILIKE-fallbacks i search_jobs (occupation + workplace_name)
CREATE INDEX IF NOT EXISTS idx_job_postings_occupation_trgm
  ON public.job_postings USING gin (occupation gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_job_postings_workplace_name_trgm
  ON public.job_postings USING gin (workplace_name gin_trgm_ops);