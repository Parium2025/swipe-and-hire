import type { OutreachChannel, OutreachRecipient, OutreachTrigger } from '@/lib/outreachTypes';

export const DEFAULT_OUTREACH_TEMPLATES: Array<{
  name: string;
  channel: OutreachChannel;
  subject: string | null;
  body: string;
  is_active: boolean;
}> = [
  {
    name: 'Ansökan inkommen · professionellt mejl',
    channel: 'email',
    subject: 'Vi har tagit emot din ansökan till {job_title}',
    body: 'Hej {candidate_name},\n\nTack för din ansökan till {job_title} hos {company_name}. Vi har nu tagit emot din ansökan och återkommer så snart vi kan.\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Ansökan inkommen · push',
    channel: 'push',
    subject: '{company_name}',
    body: 'Din ansökan till {job_title} är mottagen.',
    is_active: true,
  },
  {
    name: 'Före intervju · professionellt mejl',
    channel: 'email',
    subject: 'Påminnelse inför din intervju för {job_title}',
    body: 'Hej {candidate_name},\n\nDetta är en påminnelse om din intervju för {job_title} hos {company_name}.\nDatum: {scheduled_date}\nTid: {scheduled_time}\nTyp: {location_type}\nPlats/länk: {location_details}\n\n{message}\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Före intervju · push',
    channel: 'push',
    subject: 'Intervjupåminnelse',
    body: '{job_title} · {scheduled_date} {scheduled_time}',
    is_active: true,
  },
  {
    name: 'Efter intervju · professionellt mejl',
    channel: 'email',
    subject: 'Tack för din intervju för {job_title}',
    body: 'Hej {candidate_name},\n\nTack för intervjun för {job_title} hos {company_name}. Vi uppskattar din tid och återkommer när vi har nästa steg i processen.\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Efter intervju · push',
    channel: 'push',
    subject: '{company_name}',
    body: 'Tack för din intervju för {job_title}. Vi återkommer med nästa steg.',
    is_active: true,
  },
  {
    name: 'Chat · varm uppdatering',
    channel: 'chat',
    subject: null,
    body: 'Hej {first_name}! {message}',
    is_active: true,
  },
  {
    name: 'E-post · professionell uppdatering',
    channel: 'email',
    subject: 'Uppdatering från {company_name}',
    body: 'Hej {candidate_name},\n\n{message}\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Push · kort uppdatering',
    channel: 'push',
    subject: '{company_name}',
    body: '{message}',
    is_active: true,
  },
  {
    name: 'Gå vidare · chat',
    channel: 'chat',
    subject: null,
    body: 'Hej {first_name}! Du går vidare i processen för {job_title}. {message}',
    is_active: true,
  },
  {
    name: 'Gå vidare · e-post',
    channel: 'email',
    subject: 'Du går vidare för {job_title}',
    body: 'Hej {candidate_name},\n\nRoliga nyheter — du går vidare i processen för {job_title} hos {company_name}.\n\n{message}\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Gå vidare · push',
    channel: 'push',
    subject: '{company_name}',
    body: 'Du går vidare i processen för {job_title}.',
    is_active: true,
  },
  {
    name: 'Avslag · chat',
    channel: 'chat',
    subject: null,
    body: 'Hej {first_name}! Tack för ditt intresse för {job_title}. {message}',
    is_active: true,
  },
  {
    name: 'Avslag · e-post',
    channel: 'email',
    subject: 'Uppdatering om {job_title}',
    body: 'Hej {candidate_name},\n\nTack för din ansökan till {job_title} hos {company_name}. Vi har nu gått vidare med andra kandidater i den här processen.\n\n{message}\n\nVi uppskattar verkligen ditt intresse.\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Avslag · push',
    channel: 'push',
    subject: '{company_name}',
    body: 'Tack för din ansökan till {job_title}. Vi har gått vidare med andra kandidater.',
    is_active: true,
  },
  {
    name: 'Intervju · premiummejl',
    channel: 'email',
    subject: 'Intervju bokad för {job_title}',
    body: 'Hej {candidate_name},\n\nDin intervju för {job_title} hos {company_name} är bokad till {scheduled_date} kl. {scheduled_time}.\nPlats: {location_details}\n\n{message}\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Intervju · premiumpush',
    channel: 'push',
    subject: 'Intervju bokad',
    body: '{job_title} · {scheduled_date} {scheduled_time}',
    is_active: true,
  },
  {
    name: 'Jobb avslutat · professionellt mejl',
    channel: 'email',
    subject: 'Uppdatering kring {job_title}',
    body: 'Hej {candidate_name},\n\nTjänsten {job_title} hos {company_name} är nu avslutad. Tack för ditt intresse och för att du sökte till oss.\n\nVänliga hälsningar,\n{company_name}',
    is_active: true,
  },
  {
    name: 'Jobb avslutat · push',
    channel: 'push',
    subject: '{company_name}',
    body: 'Tjänsten {job_title} är nu avslutad. Tack för din ansökan.',
    is_active: true,
  },
];

export const DEFAULT_OUTREACH_AUTOMATIONS: Array<{
  name: string;
  trigger: Extract<OutreachTrigger, 'application_received' | 'interview_before' | 'interview_after' | 'job_closed'>;
  channel: OutreachChannel;
  recipient_type: OutreachRecipient;
  delay_minutes: number;
  templateName: string;
}> = [
  {
    name: 'Ansökan inkommen · e-post',
    trigger: 'application_received',
    channel: 'email',
    recipient_type: 'candidate',
    delay_minutes: 0,
    templateName: 'Ansökan inkommen · professionellt mejl',
  },
  {
    name: 'Ansökan inkommen · push',
    trigger: 'application_received',
    channel: 'push',
    recipient_type: 'candidate',
    delay_minutes: 0,
    templateName: 'Ansökan inkommen · push',
  },
  {
    name: 'Före intervju · e-post',
    trigger: 'interview_before',
    channel: 'email',
    recipient_type: 'candidate',
    delay_minutes: 60,
    templateName: 'Före intervju · professionellt mejl',
  },
  {
    name: 'Före intervju · push',
    trigger: 'interview_before',
    channel: 'push',
    recipient_type: 'candidate',
    delay_minutes: 60,
    templateName: 'Före intervju · push',
  },
  {
    name: 'Efter intervju · e-post',
    trigger: 'interview_after',
    channel: 'email',
    recipient_type: 'candidate',
    delay_minutes: 180,
    templateName: 'Efter intervju · professionellt mejl',
  },
  {
    name: 'Efter intervju · push',
    trigger: 'interview_after',
    channel: 'push',
    recipient_type: 'candidate',
    delay_minutes: 180,
    templateName: 'Efter intervju · push',
  },
  {
    name: 'Annons avslutas · e-post',
    trigger: 'job_closed',
    channel: 'email',
    recipient_type: 'candidate',
    delay_minutes: 10,
    templateName: 'Jobb avslutat · professionellt mejl',
  },
  {
    name: 'Annons avslutas · push',
    trigger: 'job_closed',
    channel: 'push',
    recipient_type: 'candidate',
    delay_minutes: 0,
    templateName: 'Jobb avslutat · push',
  },
];
