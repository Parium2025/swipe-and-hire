-- Update saved_jobs foreign key to CASCADE DELETE
ALTER TABLE saved_jobs 
DROP CONSTRAINT IF EXISTS saved_jobs_job_id_fkey;

ALTER TABLE saved_jobs 
ADD CONSTRAINT saved_jobs_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE;

-- Update job_applications foreign key to CASCADE DELETE
ALTER TABLE job_applications 
DROP CONSTRAINT IF EXISTS job_applications_job_id_fkey;

ALTER TABLE job_applications 
ADD CONSTRAINT job_applications_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE;

-- Also cascade delete job_questions when job is deleted
ALTER TABLE job_questions
DROP CONSTRAINT IF EXISTS job_questions_job_id_fkey;

ALTER TABLE job_questions
ADD CONSTRAINT job_questions_job_id_fkey
FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE;