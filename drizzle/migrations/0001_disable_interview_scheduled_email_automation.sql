-- Kandidaten får alltid den strukturerade intervjukallelsen (send-interview-invitation)
-- vid bokning. Det automatiska bekräftelsemejlet för samma händelse blev en
-- dubblett och stängs därför av för alla arbetsgivare. Push och chatt rörs inte.
UPDATE public.outreach_automations
SET is_enabled = false
WHERE trigger = 'interview_scheduled'
  AND channel = 'email'
  AND is_enabled = true;