CREATE INDEX IF NOT EXISTS idx_swipe_actions_user_updated ON public.swipe_actions (user_id, updated_at DESC);
DROP INDEX IF EXISTS public.idx_swipe_actions_user_id;