-- Add columns for county and municipality to job_postings table
ALTER TABLE job_postings 
ADD COLUMN workplace_county TEXT,
ADD COLUMN workplace_municipality TEXT;

-- Create index for better search performance
CREATE INDEX idx_job_postings_county ON job_postings(workplace_county);
CREATE INDEX idx_job_postings_municipality ON job_postings(workplace_municipality);

-- Add comment for documentation
COMMENT ON COLUMN job_postings.workplace_county IS 'Automatically populated from workplace_postal_code using postal code lookup';
COMMENT ON COLUMN job_postings.workplace_municipality IS 'Automatically populated from workplace_postal_code using postal code lookup';