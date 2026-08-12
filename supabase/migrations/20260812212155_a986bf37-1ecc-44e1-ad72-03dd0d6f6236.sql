CREATE UNIQUE INDEX IF NOT EXISTS job_applications_job_applicant_uidx
  ON public.job_applications (job_id, applicant_id);