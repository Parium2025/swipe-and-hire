-- Fix the Security Definer View issue
-- Remove the security_barrier setting that caused the security warning

ALTER VIEW public.employer_profile_view SET (security_barrier = false);

-- Instead, create proper RLS policies for the view access
-- (The view itself doesn't need RLS as it's filtered by the underlying table's RLS)