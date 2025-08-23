-- Add birth_date column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN birth_date DATE;

-- Create function to calculate age from birth date
CREATE OR REPLACE FUNCTION public.calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;