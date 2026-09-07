import type { OutreachTrigger } from '@/lib/outreachTypes';

export type AutoRuleChannel = 'chat' | 'email' | 'push';

export type AutoRuleEvent = {
  trigger: Extract<
    OutreachTrigger,
    | 'application_received'
    | 'interview_scheduled'
    | 'interview_before'
    | 'interview_after'
    | 'interview_cancelled'
    | 'job_closed'
  >;
  title: string;
  description: string;
  delayLabel: string;
  delayOptions: { value: number; label: string }[];
  defaultDelay: number;
  templates: Record<AutoRuleChannel, { name: string; subject: string | null; body: string }>;
};

export const AUTO_RULE_EVENTS: AutoRuleEvent[] = [
  {
    trigger: 'application_received',
    title: 'Någon söker jobbet',
    description: 'Skickas till kandidaten direkt när ansökan kommer in.',
    delayLabel: 'Skickas',
    defaultDelay: 0,
    delayOptions: [
      { value: 0, label: 'Direkt' },
      { value: 10, label: 'Efter 10 minuter' },
      { value: 60, label: 'Efter 1 timme' },
    ],
    templates: {
      email: {
        name: 'Ansökan inkommen · professionellt mejl',
        subject: 'Vi har tagit emot din ansökan till {job_title}',
        body: 'Hej {candidate_name},\n\nTack för din ansökan till {job_title} hos {company_name}. Vi har nu tagit emot din ansökan och återkommer så snart vi kan.\n\nVänliga hälsningar,\n{company_name}',
      },
      push: {
        name: 'Ansökan inkommen · push',
        subject: '{company_name}',
        body: 'Din ansökan till {job_title} är mottagen.',
      },
      chat: {
        name: 'Ansökan inkommen · chat',
        subject: null,
        body: 'Hej {first_name}! Tack för din ansökan till {job_title}. Vi återkommer så snart vi kan.',
      },
    },
  },
  {
    trigger: 'interview_scheduled',
    title: 'Intervjun bokas',
    description: 'Bekräftelse till kandidaten så fort du bokar eller bokar om en intervju.',
    delayLabel: 'Skickas',
    defaultDelay: 0,
    delayOptions: [
      { value: 0, label: 'Direkt' },
      { value: 10, label: 'Efter 10 minuter' },
      { value: 60, label: 'Efter 1 timme' },
    ],
    templates: {
      email: {
        name: 'Intervju bokad · professionellt mejl',
        subject: 'Din intervju för {job_title} är bokad',
        body: 'Hej {candidate_name},\n\nDin intervju för {job_title} hos {company_name} är nu bokad.\nDatum: {scheduled_date}\nTid: {scheduled_time}\nTyp: {location_type}\nPlats/länk: {location_details}\n\n{message}\n\nVänliga hälsningar,\n{company_name}',
      },
      push: {
        name: 'Intervju bokad · push',
        subject: 'Intervju bokad',
        body: '{job_title} · {scheduled_date} {scheduled_time}',
      },
      chat: {
        name: 'Intervju bokad · chat',
        subject: null,
        body: 'Hej {first_name}! Din intervju för {job_title} är bokad den {scheduled_date} kl. {scheduled_time}. {message}',
      },
    },
  },
  {
    trigger: 'interview_before',
    title: 'Före intervjun',
    description: 'Påminnelse till kandidaten innan bokad intervju.',
    delayLabel: 'Skickas',
    defaultDelay: 60,
    delayOptions: [
      { value: 15, label: '15 minuter innan' },
      { value: 60, label: '1 timme innan' },
      { value: 180, label: '3 timmar innan' },
      { value: 1440, label: '1 dygn innan' },
    ],
    templates: {
      email: {
        name: 'Före intervju · professionellt mejl',
        subject: 'Påminnelse inför din intervju för {job_title}',
        body: 'Hej {candidate_name},\n\nDetta är en påminnelse om din intervju för {job_title} hos {company_name}.\nDatum: {scheduled_date}\nTid: {scheduled_time}\nTyp: {location_type}\nPlats/länk: {location_details}\n\nVänliga hälsningar,\n{company_name}',
      },
      push: {
        name: 'Före intervju · push',
        subject: 'Intervjupåminnelse',
        body: '{job_title} · {scheduled_date} {scheduled_time}',
      },
      chat: {
        name: 'Före intervju · chat',
        subject: null,
        body: 'Hej {first_name}! Påminnelse om din intervju för {job_title} den {scheduled_date} kl. {scheduled_time}.',
      },
    },
  },
  {
    trigger: 'interview_after',
    title: 'Efter intervjun',
    description: 'Tack-meddelande när intervjun är genomförd.',
    delayLabel: 'Skickas',
    defaultDelay: 180,
    delayOptions: [
      { value: 60, label: '1 timme efter' },
      { value: 180, label: '3 timmar efter' },
      { value: 1440, label: '1 dygn efter' },
    ],
    templates: {
      email: {
        name: 'Efter intervju · professionellt mejl',
        subject: 'Tack för din intervju för {job_title}',
        body: 'Hej {candidate_name},\n\nTack för intervjun för {job_title} hos {company_name}. Vi uppskattar din tid och återkommer inom kort.\n\nVänliga hälsningar,\n{company_name}',
      },
      push: {
        name: 'Efter intervju · push',
        subject: '{company_name}',
        body: 'Tack för din intervju för {job_title}. Vi återkommer inom kort.',
      },
      chat: {
        name: 'Efter intervju · chat',
        subject: null,
        body: 'Hej {first_name}! Tack för intervjun för {job_title}. Vi uppskattar din tid och återkommer inom kort.',
      },
    },
  },
  {
    trigger: 'interview_cancelled',
    title: 'Intervjun avbokas',
    description: 'Besked till kandidaten när du eller kandidaten avbokar en bokad intervju.',
    delayLabel: 'Skickas',
    defaultDelay: 0,
    delayOptions: [
      { value: 0, label: 'Direkt' },
      { value: 10, label: 'Efter 10 minuter' },
      { value: 60, label: 'Efter 1 timme' },
    ],
    templates: {
      email: {
        name: 'Intervju avbokad · professionellt mejl',
        subject: 'Din intervju för {job_title} är avbokad',
        body: 'Hej {candidate_name},\n\nDin intervju för {job_title} hos {company_name} den {scheduled_date} kl. {scheduled_time} är tyvärr avbokad.\n\nVi återkommer om en ny tid.\n\nVänliga hälsningar,\n{company_name}',
      },
      push: {
        name: 'Intervju avbokad · push',
        subject: 'Intervju avbokad',
        body: '{job_title} · {scheduled_date} {scheduled_time} är avbokad.',
      },
      chat: {
        name: 'Intervju avbokad · chat',
        subject: null,
        body: 'Hej {first_name}! Din intervju för {job_title} den {scheduled_date} kl. {scheduled_time} är avbokad. Vi återkommer om en ny tid.',
      },
    },
  },
  {
    trigger: 'job_closed',
    title: 'Annonsen avslutas eller utgår',
    description: 'Alla som fortfarande är kvar i processen får besked om att den är avslutad. Kandidater du markerat som Anställd eller Avslag hoppas över.',
    delayLabel: 'Skickas',
    defaultDelay: 10,
    delayOptions: [
      { value: 0, label: 'Direkt' },
      { value: 10, label: 'Efter 10 minuter' },
      { value: 60, label: 'Efter 1 timme' },
      { value: 1440, label: 'Efter 1 dygn' },
    ],
    templates: {
      email: {
        name: 'Jobb avslutat · professionellt mejl',
        subject: 'Uppdatering kring {job_title}',
        body: 'Hej {candidate_name},\n\nTjänsten {job_title} hos {company_name} är nu avslutad. Tack för ditt intresse och för att du sökte till oss. Vi har valt att gå vidare med andra kandidater i den här processen.\n\nVi hoppas att du söker igen så snart nya tjänster dyker upp hos oss.\n\nVänliga hälsningar,\n{company_name}',
      },
      push: {
        name: 'Jobb avslutat · push',
        subject: '{company_name}',
        body: 'Tjänsten {job_title} är avslutad. Tack för ditt intresse — sök gärna igen när nya tjänster dyker upp.',
      },
      chat: {
        name: 'Jobb avslutat · chat',
        subject: null,
        body: 'Hej {first_name}! Tjänsten {job_title} är nu avslutad och vi har gått vidare med andra kandidater. Tack för ditt intresse — vi hoppas att du söker igen när nya tjänster dyker upp.',
      },
    },
  },
];


export const AUTO_RULE_CHANNELS: { value: AutoRuleChannel; label: string }[] = [
  { value: 'chat', label: 'Chatt' },
  { value: 'email', label: 'Mejl' },
  { value: 'push', label: 'Push' },
];
