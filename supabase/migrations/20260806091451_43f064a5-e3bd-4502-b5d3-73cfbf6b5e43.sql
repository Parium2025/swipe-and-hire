UPDATE public.profiles p
SET onboarding_completed = false
FROM auth.users u
WHERE p.user_id = u.id AND u.email = 'axelanderssonparium@gmail.com';