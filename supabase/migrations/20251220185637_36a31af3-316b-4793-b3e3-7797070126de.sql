-- Create a new RPC function to get applicant profile media (image, video, is_profile_video)
CREATE OR REPLACE FUNCTION public.get_applicant_profile_media(p_applicant_id uuid, p_employer_id uuid)
RETURNS TABLE (
  profile_image_url text,
  video_url text,
  is_profile_video boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if employer has an application from this applicant
  IF EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON ja.job_id = jp.id
    WHERE ja.applicant_id = p_applicant_id
    AND jp.employer_id = p_employer_id
  ) THEN
    RETURN QUERY
    SELECT p.profile_image_url, p.video_url, p.is_profile_video
    FROM profiles p
    WHERE p.user_id = p_applicant_id;
  ELSE
    RETURN;
  END IF;
END;
$$;