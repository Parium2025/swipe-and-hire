-- Add RLS policy for organization members to VIEW each other's my_candidates
CREATE POLICY "Organization members can view colleagues candidates"
ON public.my_candidates
FOR SELECT
USING (
  same_organization(auth.uid(), recruiter_id)
);

-- Create trigger function to log when a candidate is added to my_candidates
CREATE OR REPLACE FUNCTION public.log_candidate_added_to_my_candidates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recruiter_name text;
BEGIN
  -- Get the recruiter's name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_recruiter_name
  FROM public.profiles
  WHERE user_id = NEW.recruiter_id;
  
  -- Insert activity log entry
  INSERT INTO public.candidate_activities (
    applicant_id,
    user_id,
    activity_type,
    new_value,
    metadata
  ) VALUES (
    NEW.applicant_id,
    NEW.recruiter_id,
    'added_to_pipeline',
    NEW.stage,
    jsonb_build_object(
      'my_candidate_id', NEW.id,
      'recruiter_name', v_recruiter_name,
      'job_id', NEW.job_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_my_candidate_added
  AFTER INSERT ON public.my_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.log_candidate_added_to_my_candidates();