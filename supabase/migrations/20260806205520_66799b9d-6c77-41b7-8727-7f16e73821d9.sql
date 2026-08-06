UPDATE public.user_onboarding_state
SET coach_state = coalesce(coach_state, '{}'::jsonb) || jsonb_build_object('introTourDone', true)
WHERE coach_state IS NOT NULL
  AND coach_state->>'introTourDone' IS DISTINCT FROM 'true'
  AND ((coach_state->>'disabled') = 'true' OR coach_state ? 'seen');