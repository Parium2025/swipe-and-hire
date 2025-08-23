-- Fix misplaced video data: move MP4 videos from profile_image_url to video_url
UPDATE profiles 
SET 
  video_url = profile_image_url,
  profile_image_url = NULL
WHERE 
  profile_image_url IS NOT NULL 
  AND (
    profile_image_url ILIKE '%.mp4%' 
    OR profile_image_url ILIKE '%.MP4%'
    OR profile_image_url ILIKE '%.mov%'
    OR profile_image_url ILIKE '%.MOV%'
  )
  AND video_url IS NULL;