import type { Database } from '@/integrations/supabase/types';

export type OutreachChannel = Database['public']['Enums']['outreach_channel'];
export type OutreachTrigger = Database['public']['Enums']['outreach_trigger'];
export type OutreachRecipient = Database['public']['Enums']['outreach_recipient'];

export type OutreachTemplate = Database['public']['Tables']['outreach_templates']['Row'];
export type OutreachAutomation = Database['public']['Tables']['outreach_automations']['Row'];
export type OutreachDispatchLog = Database['public']['Tables']['outreach_dispatch_logs']['Row'];

export interface OutreachAutomationWithTemplate extends OutreachAutomation {
  template?: OutreachTemplate | null;
}

export interface OutreachVariableDefinition {
  key: string;
  label: string;
}

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
  { value: 'job_closed', label: 'Annons avslutas' },
  { value: 'interview_scheduled', label: 'Intervju bokas' },
  { value: 'manual_send', label: 'Manuellt utskick' },
];

export const OUTREACH_RECIPIENT_OPTIONS: { value: OutreachRecipient; label: string }[] = [
  { value: 'candidate', label: 'Kandidat' },
  { value: 'employer', label: 'Arbetsgivare' },
];

export const getOutreachChannelLabel = (channel: OutreachChannel) =>
  OUTREACH_CHANNEL_OPTIONS.find((item) => item.value === channel)?.label ?? channel;

export const getOutreachTriggerLabel = (trigger: OutreachTrigger) =>
  OUTREACH_TRIGGER_OPTIONS.find((item) => item.value === trigger)?.label ?? trigger;

export const getOutreachRecipientLabel = (recipient: OutreachRecipient) =>
  OUTREACH_RECIPIENT_OPTIONS.find((item) => item.value === recipient)?.label ?? recipient;

export const getOutreachSubjectLabel = (channel: OutreachChannel) => {
  if (channel === 'email') return 'Ämnesrad';
  if (channel === 'push') return 'Push-rubrik';
  return 'Intern rubrik';
};

export const renderOutreachText = (template: string | null | undefined, data: Record<string, string | number | null | undefined>) => {
  let output = template ?? '';

  Object.entries(data).forEach(([key, value]) => {
    output = output.replaceAll(`{${key}}`, value == null ? '' : String(value));
  });

  return output;
};

export const formatOutreachDate = (iso: string) =>
  new Date(iso).toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const formatOutreachTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
