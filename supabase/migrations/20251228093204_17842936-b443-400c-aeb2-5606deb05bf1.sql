-- Add policy for deleting own activities
CREATE POLICY "Users can delete their own activities"
ON public.candidate_activities
FOR DELETE
USING (auth.uid() = user_id);