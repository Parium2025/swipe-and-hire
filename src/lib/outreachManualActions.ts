import type { OutreachChannel, OutreachTemplate } from '@/lib/outreach';
import type { ButtonProps } from '@/components/ui/button';

export type ManualOutreachActionKey = 'progress' | 'rejection';

export interface ManualOutreachActionDefinition {
  key: ManualOutreachActionKey;
  label: string;
  buttonVariant: ButtonProps['variant'];
  keywords: string[];
}

export interface ManualOutreachTemplateGroup {
  action: ManualOutreachActionDefinition;
  channels: OutreachChannel[];
  templatesByChannel: Partial<Record<OutreachChannel, OutreachTemplate>>;
}

export const MANUAL_OUTREACH_ACTIONS: ManualOutreachActionDefinition[] = [
  {
    key: 'progress',
    label: 'Gå vidare',
    buttonVariant: 'glassGreen',
    keywords: ['gå vidare', 'ga vidare', 'vidare i processen', 'nasta steg', 'nästa steg'],
  },
  {
    key: 'rejection',
    label: 'Avslag',
    buttonVariant: 'glassRed',
    keywords: ['avslag', 'rejection', 'rejected', 'tyvarr', 'tyvärr'],
  },
];

const CHANNEL_ORDER: OutreachChannel[] = ['chat', 'email', 'push'];

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const matchesAction = (template: Pick<OutreachTemplate, 'name' | 'description'>, action: ManualOutreachActionDefinition) => {
  const text = normalizeText(`${template.name} ${template.description ?? ''}`);
  return action.keywords.some((keyword) => text.includes(normalizeText(keyword)));
};

export const getManualOutreachTemplateGroups = (templates: OutreachTemplate[]) => {
  const groups = MANUAL_OUTREACH_ACTIONS.reduce<Record<ManualOutreachActionKey, ManualOutreachTemplateGroup>>((acc, action) => {
    acc[action.key] = {
      action,
      channels: [],
      templatesByChannel: {},
    };
    return acc;
  }, {
    progress: { action: MANUAL_OUTREACH_ACTIONS[0], channels: [], templatesByChannel: {} },
    rejection: { action: MANUAL_OUTREACH_ACTIONS[1], channels: [], templatesByChannel: {} },
  });

  templates.forEach((template) => {
    const action = MANUAL_OUTREACH_ACTIONS.find((item) => matchesAction(template, item));
    if (!action) return;

    const currentGroup = groups[action.key];
    if (!currentGroup.templatesByChannel[template.channel]) {
      currentGroup.templatesByChannel[template.channel] = template;
    }
  });

  MANUAL_OUTREACH_ACTIONS.forEach((action) => {
    groups[action.key].channels = CHANNEL_ORDER.filter((channel) => Boolean(groups[action.key].templatesByChannel[channel]));
  });

  return groups;
};
