-- Atomär funktion för jobbkontext-switch
-- Antingen lyckas båda stegen eller ingen - premium Spotify-känsla
CREATE OR REPLACE FUNCTION public.switch_conversation_job_context(
  p_conversation_id uuid,
  p_new_application_id uuid,
  p_new_job_id uuid,
  p_job_title text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verifiera att användaren är medlem i konversationen
  IF NOT is_conversation_member(p_conversation_id) THEN
    RAISE EXCEPTION 'Access denied: not a conversation member';
  END IF;

  -- Atomär transaktion: båda operationerna eller ingen
  -- Steg 1: Uppdatera konversationens jobbkontext
  UPDATE public.conversations
  SET 
    application_id = p_new_application_id,
    job_id = p_new_job_id,
    updated_at = now()
  WHERE id = p_conversation_id;

  -- Steg 2: Lägg till systemmeddelande som markerar bytet
  INSERT INTO public.conversation_messages (
    conversation_id,
    sender_id,
    content,
    is_system_message
  ) VALUES (
    p_conversation_id,
    auth.uid(),
    '📋 Skriver från: ' || COALESCE(p_job_title, 'Okänd tjänst'),
    true
  );

  RETURN true;
END;
$$;