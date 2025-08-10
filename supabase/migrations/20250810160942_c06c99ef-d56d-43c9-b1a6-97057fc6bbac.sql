-- Test function to send reset password email
-- This will help us debug the flow
CREATE OR REPLACE FUNCTION test_reset_flow() 
RETURNS TEXT 
LANGUAGE plpgsql 
AS $$
BEGIN
  RETURN 'Reset flow test function created - ' || NOW()::text;
END;
$$;