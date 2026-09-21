-- Supportvyn listar aktiva respektive arkiverade ärenden, nyast först.
-- Utan index måste hela tabellen läsas när ärendena blir många.
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created_at
  ON public.support_tickets (status, created_at DESC, id DESC);

-- Meddelandena i ett ärende hämtas alltid per ärende i tidsordning.
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created_at
  ON public.support_messages (ticket_id, created_at);

-- Påminnelsesvepen söker möten i ett tidsfönster som ännu inte påmints om.
CREATE INDEX IF NOT EXISTS idx_interviews_reminder_window
  ON public.interviews (scheduled_at)
  WHERE reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_followup_window
  ON public.interviews (scheduled_at)
  WHERE followup_reminder_sent_at IS NULL;