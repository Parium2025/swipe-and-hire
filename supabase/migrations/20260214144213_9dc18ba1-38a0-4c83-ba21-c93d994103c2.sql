-- Allow job seekers to delete their own applications
CREATE POLICY "Users can delete their own applications"
ON public.job_applications
FOR DELETE
USING (auth.uid() = applicant_id);