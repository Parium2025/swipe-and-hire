-- Add new social_media_links JSONB column to handle multiple social platforms
ALTER TABLE public.profiles 
ADD COLUMN social_media_links JSONB DEFAULT '[]'::jsonb;

-- Migrate existing linkedin_url and twitter_url data to the new format
UPDATE public.profiles 
SET social_media_links = (
  SELECT jsonb_agg(social_link)
  FROM (
    SELECT jsonb_build_object('platform', 'linkedin', 'url', linkedin_url) AS social_link
    WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
    UNION ALL
    SELECT jsonb_build_object('platform', 'twitter', 'url', twitter_url) AS social_link  
    WHERE twitter_url IS NOT NULL AND twitter_url != ''
  ) links
)
WHERE linkedin_url IS NOT NULL OR twitter_url IS NOT NULL;

-- Drop the old separate columns
ALTER TABLE public.profiles 
DROP COLUMN linkedin_url,
DROP COLUMN twitter_url;