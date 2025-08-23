-- Add postal_code to profiles for syncing Swedish postnummer
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Optional: document the column
COMMENT ON COLUMN public.profiles.postal_code IS 'User postal code (SE), stored as text to preserve leading zeros and spacing-free format.';