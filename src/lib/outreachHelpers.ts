import type { OutreachChannel, OutreachRecipient, OutreachTrigger } from '@/lib/outreachTypes';
import { OUTREACH_CHANNEL_OPTIONS, OUTREACH_RECIPIENT_OPTIONS, OUTREACH_TRIGGER_OPTIONS } from '@/lib/outreachConstants';

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
    output = output.split(`{${key}}`).join(value == null ? '' : String(value));
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
