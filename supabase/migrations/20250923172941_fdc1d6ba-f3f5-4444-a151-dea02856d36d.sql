-- Ensure profile gets created for every new user
-- Create trigger on auth.users to call public.handle_new_user()

-- Drop existing trigger if present to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger that inserts a row into public.profiles (and user_roles) on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
