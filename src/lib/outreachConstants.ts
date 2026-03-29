import type { OutreachChannel, OutreachRecipient, OutreachTrigger, OutreachVariableDefinition } from '@/lib/outreachTypes';

export const OUTREACH_VARIABLES: OutreachVariableDefinition[] = [
  { key: 'candidate_name', label: 'Kandidatens namn' },
  { key: 'first_name', label: 'Förnamn' },
  { key: 'company_name', label: 'Företagsnamn' },
  { key: 'job_title', label: 'Jobbtitel' },
  { key: 'scheduled_date', label: 'Intervjudatum' },
  { key: 'scheduled_time', label: 'Intervjutid' },
  { key: 'duration_minutes', label: 'Intervjulängd' },
  { key: 'location_type', label: 'Intervjutyp' },
  { key: 'location_details', label: 'Plats/länk' },
  { key: 'message', label: 'Personligt meddelande' },
];

export const OUTREACH_CHANNEL_OPTIONS: { value: OutreachChannel; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'E-post' },
  { value: 'push', label: 'Push' },
];

export const OUTREACH_TRIGGER_OPTIONS: { value: OutreachTrigger; label: string }[] = [
  { value: 'application_received', label: 'Ansökan inkommen' },
  { value: 'application_no_response_14d', label: 'Annons avslutas' },
  { value: 'interview_before', label: 'Före intervju' },
  { value: 'interview_after', label: 'Efter intervju' },
  { value: 'job_closed', label: 'Annons avslutas' },
  { value: 'interview_scheduled', label: 'Intervju bokas' },
  { value: 'manual_send', label: 'Manuellt utskick' },
];

export const OUTREACH_RECIPIENT_OPTIONS: { value: OutreachRecipient; label: string }[] = [
  { value: 'candidate', label: 'Kandidat' },
  { value: 'employer', label: 'Arbetsgivare' },
];
