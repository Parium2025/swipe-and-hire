DROP POLICY IF EXISTS "Conversation members can view member profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_chat_member_profiles(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  company_name text,
  profile_image_url text,
  company_logo_url text,
  role public.user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.first_name, p.last_name, p.company_name,
         p.profile_image_url, p.company_logo_url, p.role
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.conversation_members cm1
        JOIN public.conversation_members cm2
          ON cm2.conversation_id = cm1.conversation_id
        WHERE cm1.user_id = auth.uid()
          AND cm2.user_id = p.user_id
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_chat_member_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_member_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_member_profiles(uuid[]) TO service_role;