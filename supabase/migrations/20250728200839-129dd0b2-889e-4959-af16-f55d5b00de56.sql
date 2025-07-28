-- Make job-applications bucket public for profile images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'job-applications';