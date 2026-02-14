
-- Fix search path on new functions
ALTER FUNCTION public.notify_new_application() SET search_path = 'public';
ALTER FUNCTION public.notify_application_status_change() SET search_path = 'public';
ALTER FUNCTION public.notify_interview_scheduled() SET search_path = 'public';
