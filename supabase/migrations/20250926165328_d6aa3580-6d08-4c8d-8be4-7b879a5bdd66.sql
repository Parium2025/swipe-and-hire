-- Add workplace address fields to job_postings table
ALTER TABLE job_postings 
ADD COLUMN workplace_name TEXT,
ADD COLUMN workplace_address TEXT,
ADD COLUMN workplace_postal_code TEXT,
ADD COLUMN workplace_city TEXT;