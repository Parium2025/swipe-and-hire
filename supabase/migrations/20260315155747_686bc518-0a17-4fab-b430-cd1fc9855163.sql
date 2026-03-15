
-- Efficient function to get conversation summaries (latest message + unread count)
-- Replaces the unbounded "fetch ALL messages" query that would crash at scale
CREATE OR REPLACE FUNCTION public.get_conversation_summaries(p_user_id uuid)
RETURNS TABLE(
  conversation_id uuid,
  last_message_content text,
  last_message_sender_id uuid,
  last_message_created_at timestamptz,
  last_message_is_system boolean,
  unread_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent spoofing
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_memberships AS (
    SELECT cm.conversation_id, cm.last_read_at
    FROM conversation_members cm
    WHERE cm.user_id = p_user_id
  ),
  latest_messages AS (
    SELECT DISTINCT ON (msg.conversation_id)
      msg.conversation_id,
      msg.content,
      msg.sender_id,
      msg.created_at,
      msg.is_system_message
    FROM conversation_messages msg
    WHERE msg.conversation_id IN (SELECT mm.conversation_id FROM my_memberships mm)
    ORDER BY msg.conversation_id, msg.created_at DESC
  ),
  unread AS (
    SELECT 
      msg.conversation_id,
      COUNT(*)::bigint AS cnt
    FROM conversation_messages msg
    JOIN my_memberships mm ON mm.conversation_id = msg.conversation_id
    WHERE msg.sender_id <> p_user_id
      AND (mm.last_read_at IS NULL OR msg.created_at > mm.last_read_at)
    GROUP BY msg.conversation_id
  )
  SELECT
    mm.conversation_id,
    lm.content,
    lm.sender_id,
    lm.created_at,
    lm.is_system_message,
    COALESCE(u.cnt, 0)::bigint
  FROM my_memberships mm
  LEFT JOIN latest_messages lm ON lm.conversation_id = mm.conversation_id
  LEFT JOIN unread u ON u.conversation_id = mm.conversation_id;
END;
$$;
