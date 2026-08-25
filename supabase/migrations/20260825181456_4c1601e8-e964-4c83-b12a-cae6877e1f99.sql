ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_social_media_links jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.profiles
SET company_social_media_links = COALESCE(social_media_links, '[]'::jsonb)
WHERE role = 'employer'
  AND company_social_media_links = '[]'::jsonb
  AND social_media_links IS NOT NULL
  AND jsonb_typeof(social_media_links) = 'array'
  AND jsonb_array_length(social_media_links) > 0;