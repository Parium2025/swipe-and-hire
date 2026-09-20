DROP TRIGGER IF EXISTS job_postings_search_vector_trigger ON public.job_postings;
CREATE TRIGGER job_postings_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, description, requirements, pitch, occupation, category,
  workplace_city, workplace_municipality, workplace_county, workplace_name, workplace_address,
  employment_type, work_schedule, part_time_shifts, part_time_days
ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.job_postings_generate_search_vector();

UPDATE public.job_postings SET title = title;