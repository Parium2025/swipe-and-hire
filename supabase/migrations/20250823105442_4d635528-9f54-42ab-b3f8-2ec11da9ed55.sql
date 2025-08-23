-- Fix the test_reset_flow function with proper security settings
CREATE OR REPLACE FUNCTION public.test_reset_flow()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN 'Reset flow test function created - ' || NOW()::text;
END;
$$;