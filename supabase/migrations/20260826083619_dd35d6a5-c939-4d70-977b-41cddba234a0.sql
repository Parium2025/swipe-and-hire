ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_category_valid
    CHECK (category IN ('technical', 'billing', 'account', 'other')),
  ADD CONSTRAINT support_tickets_message_valid
    CHECK (length(btrim(message)) BETWEEN 1 AND 20000),
  ADD CONSTRAINT support_tickets_status_valid
    CHECK (status IN ('open', 'in_progress', 'closed'));

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_message_valid
    CHECK (length(btrim(message)) BETWEEN 1 AND 20000);