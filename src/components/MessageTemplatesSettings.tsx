import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Bot,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  ScrollText,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  DEFAULT_OUTREACH_AUTOMATIONS,
  DEFAULT_OUTREACH_TEMPLATES,
  getOutreachChannelLabel,
  getOutreachRecipientLabel,
  getOutreachTriggerLabel,
  OUTREACH_CHANNEL_OPTIONS,
  OUTREACH_RECIPIENT_OPTIONS,
  OUTREACH_TRIGGER_OPTIONS,
  OUTREACH_VARIABLES,
  type OutreachAutomation,
  type OutreachDispatchLog,
  type OutreachTemplate,
  type OutreachTrigger,
} from '@/lib/outreach';
import { readCachedOutreachStudio, writeCachedOutreachStudio } from '@/lib/outreachStudioCache';

type TemplateForm = {
  id: string | null;
  name: string;
  channels: AutomationChannel[];
  channelContent: Record<AutomationChannel, { subject: string; body: string }>;
};

type AutomationChannel = 'chat' | 'email' | 'push';

type AutomationForm = {
  id: string | null;
  group_id: string | null;
  automation_ids: string[];
  name: string;
  trigger: OutreachTrigger;
  channels: AutomationChannel[];
  recipient_type: 'candidate' | 'employer';
  template_ids: Partial<Record<AutomationChannel, string>>;
  delay_minutes: number;
  is_enabled: boolean;
};

type AutomationGroup = {
  groupId: string;
  automations: OutreachAutomation[];
  channels: AutomationChannel[];
  primary: OutreachAutomation;
};

type TemplateFamily = {
  key: string;
  baseName: string;
  channels: AutomationChannel[];
  templatesByChannel: Partial<Record<AutomationChannel, OutreachTemplate>>;
  primaryTemplate: OutreachTemplate;
};

type StudioTab = 'templates' | 'automations' | 'logs';
type AutomationVisibilityFilter = 'all' | 'active' | 'paused' | 'unlinked';

type PendingDeleteAction = {
  kind: 'template' | 'automation';
  ids: string[];
  title: string;
  description: string;
  successMessage: string;
  errorMessage: string;
};

function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center text-white transition-opacity md:hover:opacity-80"
          aria-label="Visa mer information"
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] border border-white/20 bg-white/10 text-white backdrop-blur-sm">
        <p className="text-xs leading-relaxed text-white">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const EMPTY_TEMPLATE_FORM: TemplateForm = {
  id: null,
  name: '',
  channels: ['push'],
  channelContent: {
    chat: { subject: '', body: '' },
    email: { subject: '', body: '' },
    push: { subject: '', body: '' },
  },
};

const TEMPLATE_EDITOR_VARIABLES = OUTREACH_VARIABLES.filter((variable) =>
  ['candidate_name', 'first_name', 'company_name', 'job_title', 'message'].includes(variable.key),
);

const EMPTY_AUTOMATION_FORM: AutomationForm = {
  id: null,
  group_id: null,
  automation_ids: [],
  name: '',
  trigger: 'application_received',
  channels: [],
  recipient_type: 'candidate',
  template_ids: {},
  delay_minutes: 0,
  is_enabled: true,
};

const CHANNEL_ORDER: AutomationChannel[] = ['chat', 'email', 'push'];

const isAutomationChannel = (value: string): value is AutomationChannel => CHANNEL_ORDER.includes(value as AutomationChannel);

const getAutomationGroupId = (automation: OutreachAutomation) => {
  const filters = automation.filters;

  if (filters && typeof filters === 'object' && !Array.isArray(filters)) {
    const groupId = (filters as Record<string, unknown>).group_id;
    if (typeof groupId === 'string' && groupId.trim()) return groupId;
  }

  return automation.id;
};

const getTemplateFamilyName = (name: string) => {
  const channelSuffixes = OUTREACH_CHANNEL_OPTIONS.map((option) => ` · ${option.label}`);
  const suffix = channelSuffixes.find((value) => name.endsWith(value));
  return suffix ? name.slice(0, -suffix.length) : name;
};

const getDelayFieldLabel = (trigger: OutreachTrigger) => {
  switch (trigger) {
    case 'interview_before':
      return 'Minuter före intervjun';
    case 'interview_after':
      return 'Minuter efter intervjun';
    default:
      return 'Väntetid (min)';
  }
};

const getDelayFieldHint = (trigger: OutreachTrigger) => {
  switch (trigger) {
    case 'interview_before':
      return 'Exempel: 60 = skicka 1 timme innan intervjun.';
    case 'interview_after':
      return 'Exempel: 180 = skicka 3 timmar efter intervjun.';
    case 'application_received':
      return '0 betyder direkt när ansökan kommer in.';
    default:
      return '0 betyder direkt när händelsen sker.';
  }
};

const AUTOMATION_VISIBILITY_OPTIONS: { value: AutomationVisibilityFilter; label: string }[] = [
  { value: 'all', label: 'Alla regler' },
  { value: 'active', label: 'Aktiva regler' },
  { value: 'paused', label: 'Pausade regler' },
  { value: 'unlinked', label: 'Saknar regel' },
];

const normalizeTimelineTrigger = (trigger: OutreachTrigger): OutreachTrigger =>
  trigger === 'application_no_response_14d' ? 'job_closed' : trigger;

const getLinkedAutomationGroup = (family: TemplateFamily, groups: AutomationGroup[]) => (
  groups.find((group) => {
    const matchedChannels = family.channels.filter((channel) => {
      const template = family.templatesByChannel[channel];
      return group.automations.some((automation) => automation.channel === channel && automation.template_id === template?.id);
    });

    return matchedChannels.length === family.channels.length && group.channels.length === family.channels.length;
  }) ?? null
);

const getAutomationGroupState = (group: AutomationGroup | null) => {
  if (!group) {
    return {
      key: 'unlinked' as const,
      label: 'Ingen regel',
      badgeClassName: 'border-white/10 bg-white/5 text-white',
    };
  }

  if (group.automations.some((automation) => automation.is_enabled)) {
      return {
        key: 'active' as const,
        label: 'Aktiv',
        badgeClassName: 'border-green-500/30 bg-green-500/20 text-green-300',
      };
  }

  return {
    key: 'paused' as const,
    label: 'Pausad',
    badgeClassName: 'border-white/20 bg-white/10 text-white',
  };
};

const matchesAutomationVisibilityFilter = (group: AutomationGroup | null, filter: AutomationVisibilityFilter) => {
  if (filter === 'all') return true;
  return getAutomationGroupState(group).key === filter;
};

const formatAutomationDelay = (minutes: number) => (minutes === 0 ? 'Direkt' : `${minutes} min`);

const getLogPayload = (log: OutreachDispatchLog) => {
  if (!log.payload || typeof log.payload !== 'object' || Array.isArray(log.payload)) return null;
  return log.payload as Record<string, unknown>;
};

const getLogOpenedAt = (log: OutreachDispatchLog) => {
  const value = getLogPayload(log)?.opened_at;
  return typeof value === 'string' ? value : null;
};

const isDeliveredLog = (log: OutreachDispatchLog) => log.status === 'sent' || log.status === 'opened';

const getLogStatusLabel = (log: OutreachDispatchLog) => {
  switch (log.status) {
    case 'pending':
      return 'Väntar';
    case 'failed':
      return 'Misslyckat';
    case 'opened':
      return 'Öppnat';
    case 'sent':
      return 'Levererat';
    default:
      return log.status;
  }
};

const getLogStatusBadgeClassName = (status: string) => {
  switch (status) {
    case 'failed':
      return 'border-destructive/40 bg-destructive/15 text-destructive';
    case 'opened':
      return 'border-primary/40 bg-primary/15 text-white';
    case 'sent':
      return 'border-white/20 bg-white/10 text-white';
    default:
      return 'border-white/10 bg-white/5 text-white';
  }
};

export function MessageTemplatesSettings() {
  const { user, profile } = useAuth();
  const organizationId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  const cachedStudio = useMemo(() => (user ? readCachedOutreachStudio(user.id) : null), [user]);
  const [templates, setTemplates] = useState<OutreachTemplate[]>(() => cachedStudio?.templates ?? []);
  const [automations, setAutomations] = useState<OutreachAutomation[]>(() => cachedStudio?.automations ?? []);
  const [logs, setLogs] = useState<OutreachDispatchLog[]>(() => cachedStudio?.logs ?? []);
  const [loading, setLoading] = useState(!cachedStudio);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [runningDispatch, setRunningDispatch] = useState(false);
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('templates');
  const templatesTabRef = useRef<HTMLButtonElement>(null);
  const automationsTabRef = useRef<HTMLButtonElement>(null);
  const logsTabRef = useRef<HTMLButtonElement>(null);
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState({ left: 4, width: 0 });
  const [templateForm, setTemplateForm] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const [activeTemplateChannel, setActiveTemplateChannel] = useState<AutomationChannel>('push');
  const [automationForm, setAutomationForm] = useState<AutomationForm>(EMPTY_AUTOMATION_FORM);
  const [selectedTemplateFamilyKey, setSelectedTemplateFamilyKey] = useState<string | null>(null);
  const [automationVisibilityFilter, setAutomationVisibilityFilter] = useState<AutomationVisibilityFilter>('all');
  const [pendingDeleteAction, setPendingDeleteAction] = useState<PendingDeleteAction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSeedConfirmDialog, setShowSeedConfirmDialog] = useState(false);
  const fetchRequestIdRef = useRef(0);

  const activeTemplatesByChannel = useMemo(() => ({
    chat: templates.filter((template) => template.channel === 'chat' && template.is_active),
    email: templates.filter((template) => template.channel === 'email' && template.is_active),
    push: templates.filter((template) => template.channel === 'push' && template.is_active),
  }), [templates]);

  const automationGroups = useMemo<AutomationGroup[]>(() => {
    const grouped = new Map<string, OutreachAutomation[]>();

    automations.forEach((automation) => {
      const groupId = getAutomationGroupId(automation);
      const existing = grouped.get(groupId) ?? [];
      existing.push(automation);
      grouped.set(groupId, existing);
    });

    return Array.from(grouped.entries()).map(([groupId, items]) => {
      const sortedItems = [...items].sort(
        (a, b) => CHANNEL_ORDER.indexOf(a.channel as AutomationChannel) - CHANNEL_ORDER.indexOf(b.channel as AutomationChannel),
      );

      return {
        groupId,
        automations: sortedItems,
        channels: CHANNEL_ORDER.filter((channel) => sortedItems.some((item) => item.channel === channel)),
        primary: sortedItems[0],
      };
    });
  }, [automations]);

  const templateFamilies = useMemo<TemplateFamily[]>(() => {
    const grouped = new Map<string, TemplateFamily>();

    templates.forEach((template) => {
      const baseName = getTemplateFamilyName(template.name);
      const existing = grouped.get(baseName);

      if (existing) {
        existing.templatesByChannel[template.channel as AutomationChannel] = template;
        existing.channels = CHANNEL_ORDER.filter((channel) => Boolean(existing.templatesByChannel[channel]));
        if (new Date(template.created_at).getTime() > new Date(existing.primaryTemplate.created_at).getTime()) {
          existing.primaryTemplate = template;
        }
        return;
      }

      grouped.set(baseName, {
        key: baseName,
        baseName,
        channels: [template.channel as AutomationChannel],
        templatesByChannel: { [template.channel]: template },
        primaryTemplate: template,
      });
    });

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.primaryTemplate.created_at).getTime() - new Date(a.primaryTemplate.created_at).getTime(),
    );
  }, [templates]);

  const selectedTemplateFamily = useMemo(
    () => templateFamilies.find((family) => family.key === selectedTemplateFamilyKey) ?? null,
    [templateFamilies, selectedTemplateFamilyKey],
  );

  const filteredTemplateFamilies = useMemo(
    () => templateFamilies.filter((family) => matchesAutomationVisibilityFilter(getLinkedAutomationGroup(family, automationGroups), automationVisibilityFilter)),
    [automationGroups, automationVisibilityFilter, templateFamilies],
  );

  const selectedAutomationGroup = useMemo(() => {
    if (!selectedTemplateFamily) return null;

    return getLinkedAutomationGroup(selectedTemplateFamily, automationGroups);
  }, [automationGroups, selectedTemplateFamily]);

  const automationFormHasAllTemplates = automationForm.channels.length > 0 && automationForm.channels.every((channel) => Boolean(automationForm.template_ids[channel]));

  const logSummary = useMemo(() => logs.reduce(
    (acc, log) => {
      if (log.status === 'pending') acc.pending += 1;
      if (log.status === 'failed') acc.failed += 1;
      if (isDeliveredLog(log)) acc.delivered += 1;
      if (log.status === 'opened' || Boolean(getLogOpenedAt(log))) acc.opened += 1;
      return acc;
    },
    { pending: 0, delivered: 0, failed: 0, opened: 0 },
  ), [logs]);

  const buildAutomationFormFromFamily = (family: TemplateFamily, group: AutomationGroup | null): AutomationForm => ({
    id: group?.primary.id ?? null,
    group_id: group?.groupId ?? null,
    automation_ids: group?.automations.map((automation) => automation.id) ?? [],
    name: group?.primary.name ?? family.baseName,
    trigger:
      group?.primary.trigger && group.primary.trigger !== 'manual_send'
        ? normalizeTimelineTrigger(group.primary.trigger)
        : 'application_received',
    channels: family.channels,
    recipient_type: 'candidate',
    template_ids: family.channels.reduce<Partial<Record<AutomationChannel, string>>>((acc, channel) => {
      const template = family.templatesByChannel[channel];
      if (template) acc[channel] = template.id;
      return acc;
    }, {}),
    delay_minutes: group?.primary.delay_minutes ?? 0,
    is_enabled: group ? group.automations.some((automation) => automation.is_enabled) : true,
  });

  const fetchStudio = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;

    const requestId = ++fetchRequestIdRef.current;
    const cached = readCachedOutreachStudio(user.id);

    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setLoading(!cached);
    }

    const [templatesRes, automationsRes, logsRes] = await Promise.all([
      supabase.from('outreach_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('outreach_automations').select('*').order('created_at', { ascending: false }),
      supabase.from('outreach_dispatch_logs').select('*').order('created_at', { ascending: false }).limit(40),
    ]);

    if (requestId !== fetchRequestIdRef.current) return;

    const firstError = templatesRes.error || automationsRes.error || logsRes.error;

    if (firstError) {
      console.error('Error fetching outreach studio:', firstError);
      if (!cached) {
        toast.error('Kunde inte läsa in Outreach Studio');
      }
    } else {
      const nextStudio = {
        templates: templatesRes.data || [],
        automations: automationsRes.data || [],
        logs: logsRes.data || [],
      };

      setTemplates(nextStudio.templates);
      setAutomations(nextStudio.automations);
      setLogs(nextStudio.logs);
      writeCachedOutreachStudio(user.id, nextStudio);
    }

    setLoading(false);
    setIsRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const cached = readCachedOutreachStudio(user.id);
    if (cached) {
      setTemplates(cached.templates);
      setAutomations(cached.automations);
      setLogs(cached.logs);
      setLoading(false);
    }

    void fetchStudio({ silent: Boolean(cached) });
  }, [user, fetchStudio]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`outreach-studio-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outreach_templates' },
        () => void fetchStudio({ silent: true }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outreach_automations' },
        () => void fetchStudio({ silent: true }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outreach_dispatch_logs' },
        () => void fetchStudio({ silent: true }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStudio]);

  useEffect(() => {
    if (templateForm.channels.length === 0) return;
    if (!templateForm.channels.includes(activeTemplateChannel)) {
      setActiveTemplateChannel(templateForm.channels[0]);
    }
  }, [templateForm.channels, activeTemplateChannel]);

  useEffect(() => {
    if (templateFamilies.length === 0) {
      if (selectedTemplateFamilyKey !== null) setSelectedTemplateFamilyKey(null);
      return;
    }

    if (!selectedTemplateFamilyKey || !templateFamilies.some((family) => family.key === selectedTemplateFamilyKey)) {
      setSelectedTemplateFamilyKey(templateFamilies[0].key);
    }
  }, [templateFamilies, selectedTemplateFamilyKey]);

  useEffect(() => {
    if (filteredTemplateFamilies.length === 0) return;

    if (!selectedTemplateFamilyKey || !filteredTemplateFamilies.some((family) => family.key === selectedTemplateFamilyKey)) {
      setSelectedTemplateFamilyKey(filteredTemplateFamilies[0].key);
    }
  }, [filteredTemplateFamilies, selectedTemplateFamilyKey]);

  useEffect(() => {
    if (!selectedTemplateFamily) {
      setAutomationForm(EMPTY_AUTOMATION_FORM);
      return;
    }

    setAutomationForm(buildAutomationFormFromFamily(selectedTemplateFamily, selectedAutomationGroup));
  }, [selectedTemplateFamily, selectedAutomationGroup]);

  useEffect(() => {
    setAutomationForm((prev) => {
      const nextTemplateIds = { ...prev.template_ids };
      let changed = false;

      CHANNEL_ORDER.forEach((channel) => {
        const isSelected = prev.channels.includes(channel);
        const channelTemplates = activeTemplatesByChannel[channel];

        if (!isSelected) {
          if (channel in nextTemplateIds) {
            delete nextTemplateIds[channel];
            changed = true;
          }
          return;
        }

        const currentTemplateId = nextTemplateIds[channel] ?? '';
        const isValid = currentTemplateId ? channelTemplates.some((template) => template.id === currentTemplateId) : false;
        const fallbackTemplateId = channelTemplates[0]?.id ?? '';

        if (!isValid && currentTemplateId !== fallbackTemplateId) {
          nextTemplateIds[channel] = fallbackTemplateId;
          changed = true;
        }
      });

      return changed ? { ...prev, template_ids: nextTemplateIds } : prev;
    });
  }, [activeTemplatesByChannel, automationForm.channels]);

  useEffect(() => {
    const updateIndicator = () => {
      const refs = {
        templates: templatesTabRef,
        automations: automationsTabRef,
        logs: logsTabRef,
      } as const;

      const currentRef = refs[activeStudioTab]?.current;
      if (!currentRef) return;

      setTabIndicatorStyle({
        left: currentRef.offsetLeft,
        width: currentRef.offsetWidth,
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeStudioTab, templates.length, automations.length, logs.length]);

  const seedDefaults = async () => {
    if (!user) return;
    setSeeding(true);

    const existingNames = new Set(templates.map((template) => template.name));
    const templateRows = DEFAULT_OUTREACH_TEMPLATES.filter((template) => !existingNames.has(template.name)).map((template) => ({
      owner_user_id: user.id,
      organization_id: organizationId,
      name: template.name,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      is_active: template.is_active,
      is_default: false,
    }));

    if (templateRows.length > 0) {
      const { error } = await supabase.from('outreach_templates').insert(templateRows);
      if (error) {
        toast.error('Kunde inte skapa startmallarna');
        setSeeding(false);
        return;
      }
    }

    const { data: freshTemplates, error: templatesError } = await supabase.from('outreach_templates').select('*');
    if (templatesError || !freshTemplates) {
      toast.error('Kunde inte slutföra snabbstarten');
      setSeeding(false);
      return;
    }

    const existingAutomationNames = new Set(automations.map((automation) => automation.name));
    const automationRows = DEFAULT_OUTREACH_AUTOMATIONS.filter((automation) => !existingAutomationNames.has(automation.name))
      .map((automation) => {
        const template = freshTemplates.find((item) => item.name === automation.templateName);
        if (!template) return null;
        return {
          owner_user_id: user.id,
          organization_id: organizationId,
          name: automation.name,
          trigger: automation.trigger,
          channel: automation.channel,
          recipient_type: automation.recipient_type,
          template_id: template.id,
          delay_minutes: automation.delay_minutes,
          filters: {},
          is_enabled: true,
        };
      })
      .filter(Boolean);

    if (automationRows.length > 0) {
      const { error } = await supabase.from('outreach_automations').insert(automationRows as never);
      if (error) {
        toast.error('Mallar skapades men reglerna kunde inte aktiveras');
        setSeeding(false);
        await fetchStudio({ silent: true });
        return;
      }
    }

    toast.success('Snabbstart aktiverad');
    setSeeding(false);
    await fetchStudio({ silent: true });
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateForm.name.trim() || templateForm.channels.length === 0) return;

    const selectedChannels = CHANNEL_ORDER.filter((channel) => templateForm.channels.includes(channel));
    const missingBody = selectedChannels.some((channel) => !templateForm.channelContent[channel].body.trim());

    if (missingBody) {
      toast.error('Fyll i innehåll för alla valda kanaler');
      return;
    }

    setSavingTemplate(true);

    const baseName = templateForm.name.trim();
    const createPayload = (channel: AutomationChannel, name: string) => ({
      owner_user_id: user.id,
      organization_id: organizationId,
      name,
      channel,
      subject: channel === 'chat' ? null : templateForm.channelContent[channel].subject.trim() || null,
      body: templateForm.channelContent[channel].body.trim(),
      is_active: true,
    });

    if (templateForm.id) {
      const [primaryChannel, ...extraChannels] = selectedChannels;
      const { error: updateError } = await supabase
        .from('outreach_templates')
        .update(createPayload(primaryChannel, baseName))
        .eq('id', templateForm.id);

      if (updateError) {
        toast.error('Kunde inte uppdatera mallen');
        setSavingTemplate(false);
        return;
      }

      if (extraChannels.length > 0) {
        const extraRows = extraChannels.map((channel) => ({
          ...createPayload(channel, `${baseName} · ${getOutreachChannelLabel(channel)}`),
          is_default: false,
        }));

        const { error: insertError } = await supabase.from('outreach_templates').insert(extraRows);
        if (insertError) {
          toast.error('Mallen uppdaterades, men kopior kunde inte skapas för alla kanaler');
          setSavingTemplate(false);
          await fetchStudio({ silent: true });
          return;
        }
      }

      toast.success('Mall uppdaterad');
        setSelectedTemplateFamilyKey(baseName);
      setTemplateForm(EMPTY_TEMPLATE_FORM);
      setActiveTemplateChannel('push');
      await fetchStudio({ silent: true });
    } else {
      const rows = selectedChannels.map((channel) => ({
        ...createPayload(
          channel,
          selectedChannels.length > 1 ? `${baseName} · ${getOutreachChannelLabel(channel)}` : baseName,
        ),
        is_default: false,
      }));

      const { error } = await supabase.from('outreach_templates').insert(rows);

      if (error) {
        toast.error('Kunde inte spara mallen');
      } else {
        toast.success('Mall skapad');
        setSelectedTemplateFamilyKey(baseName);
        setTemplateForm(EMPTY_TEMPLATE_FORM);
        setActiveTemplateChannel('push');
        await fetchStudio({ silent: true });
      }
    }

    setSavingTemplate(false);
  };

  const toggleTemplateChannel = (channel: AutomationChannel) => {
    setTemplateForm((prev) => {
      const isSelected = prev.channels.includes(channel);

      if (isSelected) {
        return {
          ...prev,
          channels: prev.channels.filter((value) => value !== channel),
        };
      }

      const sourceChannel = prev.channels[0] ?? channel;
      const sourceContent = prev.channelContent[sourceChannel];
      const existing = prev.channelContent[channel];
      const shouldCopy = !existing.body.trim() && !existing.subject.trim();

      return {
        ...prev,
        channels: [...prev.channels, channel].sort(
          (a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b),
        ),
        channelContent: {
          ...prev.channelContent,
          [channel]: shouldCopy ? { ...sourceContent } : existing,
        },
      };
    });
  };

  const setTemplateChannelContent = (
    channel: AutomationChannel,
    field: 'subject' | 'body',
    value: string,
  ) => {
    setTemplateForm((prev) => ({
      ...prev,
      channelContent: {
        ...prev.channelContent,
        [channel]: {
          ...prev.channelContent[channel],
          [field]: value,
        },
      },
    }));
  };

  const handleSaveAutomation = async () => {
    if (!user || !automationForm.name.trim() || automationForm.channels.length === 0) return;

    const missingTemplate = automationForm.channels.some((channel) => !automationForm.template_ids[channel]);
    if (missingTemplate) {
      toast.error('Välj en mall för varje vald kanal');
      return;
    }

    setSavingAutomation(true);

    const groupId = automationForm.group_id ?? crypto.randomUUID();
    const basePayload = {
      owner_user_id: user.id,
      organization_id: organizationId,
      name: automationForm.name.trim(),
      trigger: automationForm.trigger,
      recipient_type: automationForm.recipient_type,
      delay_minutes: automationForm.delay_minutes,
      filters: { group_id: groupId },
      is_enabled: automationForm.is_enabled,
    };

    const existingAutomations = automations.filter((automation) => automationForm.automation_ids.includes(automation.id));
    const existingByChannel = new Map(existingAutomations.map((automation) => [automation.channel as AutomationChannel, automation]));
    const selectedChannels = new Set(automationForm.channels);

    const updates = automationForm.channels
      .map((channel) => {
        const existing = existingByChannel.get(channel);
        if (!existing) return null;

        return supabase
          .from('outreach_automations')
          .update({
            ...basePayload,
            channel,
            template_id: automationForm.template_ids[channel] ?? '',
          })
          .eq('id', existing.id);
      })
      .filter(Boolean);

    const inserts = automationForm.channels
      .filter((channel) => !existingByChannel.has(channel))
      .map((channel) => ({
        ...basePayload,
        channel,
        template_id: automationForm.template_ids[channel] ?? '',
      }));

    const removeIds = existingAutomations
      .filter((automation) => !selectedChannels.has(automation.channel as AutomationChannel))
      .map((automation) => automation.id);

    const results = await Promise.all([
      ...updates,
      ...(inserts.length > 0 ? [supabase.from('outreach_automations').insert(inserts)] : []),
      ...(removeIds.length > 0 ? [supabase.from('outreach_automations').delete().in('id', removeIds)] : []),
    ]);

    const failedResult = results.find((result) => result?.error);

    if (failedResult?.error) {
      toast.error('Kunde inte spara regeln');
    } else {
      toast.success(automationForm.id ? 'Regel uppdaterad' : 'Regel skapad');
      setAutomationForm(EMPTY_AUTOMATION_FORM);
      await fetchStudio({ silent: true });
    }

    setSavingAutomation(false);
  };

  const handleDeleteTemplate = async (id: string, successMessage = 'Mall borttagen', errorMessage = 'Kunde inte ta bort mallen') => {
    const { error } = await supabase
      .from('outreach_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(errorMessage);
    } else {
      toast.success(successMessage);
      await fetchStudio({ silent: true });
    }
  };

  const handleDeleteAutomation = async (ids: string[], successMessage = 'Regel borttagen', errorMessage = 'Kunde inte ta bort regeln') => {
    const { error } = await supabase
      .from('outreach_automations')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error(errorMessage);
    } else {
      toast.success(successMessage);
      await fetchStudio({ silent: true });
    }
  };

  const openDeleteTemplateDialog = (template: OutreachTemplate) => {
    setPendingDeleteAction({
      kind: 'template',
      ids: [template.id],
      title: 'Ta bort mall',
      description: `Är du säker på att du vill ta bort mallen "${template.name}"? Denna åtgärd går inte att ångra.`,
      successMessage: 'Mall borttagen',
      errorMessage: 'Kunde inte ta bort mallen',
    });
  };

  const openDeleteAutomationDialog = (group: AutomationGroup, family: TemplateFamily | null) => {
    const ruleName = family?.baseName ?? group.primary.name;

    setPendingDeleteAction({
      kind: 'automation',
      ids: group.automations.map((automation) => automation.id),
      title: 'Ta bort regel',
      description: `Är du säker på att du vill ta bort regeln "${ruleName}"? Denna åtgärd går inte att ångra.`,
      successMessage: 'Regel borttagen',
      errorMessage: 'Kunde inte ta bort regeln',
    });
  };

  const handleConfirmDelete = async () => {
    const action = pendingDeleteAction;
    if (!action || isDeleting) return;

    setIsDeleting(true);

    try {
      if (action.kind === 'template') {
        await handleDeleteTemplate(action.ids[0], action.successMessage, action.errorMessage);
      } else {
        await handleDeleteAutomation(action.ids, action.successMessage, action.errorMessage);
      }

      setPendingDeleteAction(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAutomation = async (group: AutomationGroup, enabled: boolean) => {
    const { error } = await supabase.from('outreach_automations').update({ is_enabled: enabled }).in('id', group.automations.map((automation) => automation.id));
    if (error) {
      toast.error('Kunde inte uppdatera regeln');
      return;
    }
    setAutomations((prev) => prev.map((item) => (group.automations.some((automation) => automation.id === item.id) ? { ...item, is_enabled: enabled } : item)));
  };

  const handleRunDispatch = async () => {
    setRunningDispatch(true);
    const { data, error } = await supabase.functions.invoke('outreach-dispatch', { body: { processPending: true } });
    if (error) {
      toast.error('Kunde inte skicka väntande utskick');
    } else {
      const count = Number((data as { processedCount?: number } | null)?.processedCount ?? 0);
      toast.success(count > 0 ? `${count} utskick skickades` : 'Inga väntande utskick');
      await fetchStudio({ silent: true });
    }
    setRunningDispatch(false);
  };

  const handleCreateAutomationShortcut = () => {
    const firstUnlinkedFamily = templateFamilies.find((family) => !getLinkedAutomationGroup(family, automationGroups));

    if (!firstUnlinkedFamily) {
      toast.info('Alla mallar har redan en regel. Välj en befintlig regel i dropdownen för att redigera den.');
      return;
    }

    setAutomationVisibilityFilter('unlinked');
    setSelectedTemplateFamilyKey(firstUnlinkedFamily.key);
  };

  return (
    <TooltipProvider delayDuration={120}>
      <AlertDialog
        open={Boolean(pendingDeleteAction)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDeleteAction(null);
        }}
      >
        <AlertDialogContentNoFocus className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-white/10 p-4 text-white shadow-lg backdrop-blur-sm sm:max-w-md sm:p-6">
          <AlertDialogHeader className="space-y-3 text-center">
            <AlertDialogTitle className="text-base font-semibold text-white md:text-lg">
              {pendingDeleteAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-white">
              {pendingDeleteAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-row gap-2 sm:justify-center">
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setPendingDeleteAction(null)}
              className="mt-0 flex-1 rounded-full border-white/20 bg-white/10 text-sm text-white transition-all duration-300 md:hover:border-white/50 md:hover:bg-white/20 md:hover:text-white"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructiveSoft"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              className="flex-1 rounded-full text-sm"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      <AlertDialog open={showSeedConfirmDialog} onOpenChange={setShowSeedConfirmDialog}>
        <AlertDialogContentNoFocus className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-white/10 p-4 text-white shadow-lg backdrop-blur-sm sm:max-w-lg sm:p-6">
          <AlertDialogHeader className="space-y-3 text-center">
            <AlertDialogTitle className="text-base font-semibold text-white md:text-lg">Kom igång snabbt</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-sm leading-relaxed text-white">
              <p>Det här lägger in färdiga startmallar och standardregler så att ni snabbt kommer igång med Outreach Studio.</p>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-white">
                <p className="text-xs uppercase tracking-[0.16em] text-white/80">Det som skapas</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-white">
                  <li>Färdiga mallar för chatt, e-post och push</li>
                  <li>Standardregler för vanliga steg i kandidatflödet</li>
                  <li>Allt går att redigera eller ta bort efteråt</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-row gap-2 sm:justify-center">
            <AlertDialogCancel className="mt-0 flex-1 rounded-full border-white/20 bg-white/10 text-sm text-white transition-all duration-300 md:hover:border-white/50 md:hover:bg-white/20 md:hover:text-white">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={(event) => {
                event.preventDefault();
                setShowSeedConfirmDialog(false);
                void seedDefaults();
              }}
              className="flex-1 rounded-full text-sm"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Fortsätt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white md:text-base">Mallar, regler och utskick</h3>
          <p className="text-xs text-white md:text-sm">Skapa meddelanden och välj när de ska skickas.</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="glassPurple" onClick={() => setShowSeedConfirmDialog(true)} disabled={seeding} className="h-[var(--control-height-compact)] px-2.5 text-[11px] md:text-xs">
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Kom igång snabbt
            </Button>
            <InfoHint text="Lägger in färdiga startmallar och standardregler som ni sedan kan redigera efter företagets ton och process." />
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="glassBlue" onClick={handleRunDispatch} disabled={runningDispatch} className="h-[var(--control-height-compact)] px-2.5 text-[11px] md:text-xs">
              {runningDispatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Skicka nu
            </Button>
            <InfoHint text="Kör väntande utskick direkt. Bra vid test eller om ni vill trigga utskick manuellt utan att vänta på nästa schemalagda körning." />
          </div>
        </div>
      </div>

      <div className="mb-3 grid gap-1.5 md:grid-cols-3">
          {[
          { label: 'Mallar', value: templates.length, icon: Bot },
           { label: 'Aktiva regler', value: automationGroups.filter((group) => group.automations.some((item) => item.is_enabled)).length, icon: RefreshCw },
          { label: 'Väntar på att skickas', value: logs.filter((item) => item.status === 'pending').length, icon: ScrollText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white md:text-[11px]">{label}</p>
                <p className="mt-0.5 text-base font-semibold text-white md:text-lg">{value}</p>
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Icon className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={activeStudioTab} onValueChange={(value) => setActiveStudioTab(value as StudioTab)} className="space-y-2.5">
        <div className="relative mx-auto flex w-fit gap-0.5 rounded-md border border-white/10 bg-white/5 p-1 backdrop-blur-[2px]" role="tablist" aria-label="Outreach sektioner">
          <motion.div
            className="absolute bottom-1 top-1 rounded-[5px] bg-parium-navy"
            initial={false}
            animate={{
              left: tabIndicatorStyle.left,
              width: tabIndicatorStyle.width,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 35,
              mass: 0.8,
            }}
          />
          <button
            ref={templatesTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'templates'}
            onClick={() => setActiveStudioTab('templates')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            Mallar
          </button>
          <button
            ref={automationsTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'automations'}
            onClick={() => setActiveStudioTab('automations')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            Regler
          </button>
          <button
            ref={logsTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'logs'}
            onClick={() => setActiveStudioTab('logs')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            Logg
          </button>
        </div>

        <TabsContent value="templates" className="mt-0 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white md:text-base">Mallbibliotek</h4>
                <p className="text-xs text-white md:text-sm">Skriv färdiga meddelanden för varje kanal.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga mallar ännu.</div>
            ) : (
                <div className="space-y-2">
                {templates.map((template) => (
                    <div key={template.id} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="max-w-full truncate text-sm font-semibold text-white">{template.name}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(template.channel)}</span>
                          {!template.is_active && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">Inaktiv</span>}
                        </div>
                        {template.subject && <p className="text-[11px] text-white md:text-xs">{template.subject}</p>}
                        <p className="line-clamp-2 text-xs text-white md:text-sm">{template.body}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="outlineNeutral"
                          size="sm"
                          className="h-7 w-7 rounded-full border-white/10 p-0 text-white transition-colors md:hover:border-white/20 md:hover:bg-white/10 md:hover:text-white"
                          onClick={() => setTemplateForm({
                            id: template.id,
                            name: template.name,
                            channels: [template.channel as AutomationChannel],
                            channelContent: {
                              chat: {
                                subject: template.channel === 'chat' ? template.subject ?? '' : '',
                                body: template.channel === 'chat' ? template.body : '',
                              },
                              email: {
                                subject: template.channel === 'email' ? template.subject ?? '' : '',
                                body: template.channel === 'email' ? template.body : '',
                              },
                              push: {
                                subject: template.channel === 'push' ? template.subject ?? '' : '',
                                body: template.channel === 'push' ? template.body : '',
                              },
                            },
                          })}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          variant="outlineNeutral"
                          size="sm"
                          className="h-7 w-7 rounded-full border-destructive/40 bg-destructive/20 p-0 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
                          onClick={() => openDeleteTemplateDialog(template)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white md:text-base">Skapa mall</h4>
                  <InfoHint text="Här bygger du grunden för automatiska eller manuella utskick. Börja med namn, välj kanaler och skriv sedan innehåll per kanal." />
                </div>
                <p className="text-xs text-white md:text-sm">Använd variabler för att göra utskicken personliga.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-white">Namn</Label>
                <InfoHint text="Ge mallen ett tydligt namn som gör det lätt att förstå när den ska användas, till exempel 'Intervju bokad' eller 'Avslutad annons'." />
              </div>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-white">Kanaler</Label>
                <InfoHint text="Välj var meddelandet ska kunna skickas. Om du väljer flera kanaler skapas en version per kanal som du kan anpassa separat." />
              </div>
              <p className="text-[11px] text-white">Välj flera kanaler så dupliceras mallen automatiskt per kanal.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {OUTREACH_CHANNEL_OPTIONS.map((option) => {
                  const channel = option.value as AutomationChannel;
                  const checked = templateForm.channels.includes(channel);

                  return (
                    <div
                      key={option.value}
                      role="button"
                      tabIndex={0}
                      aria-pressed={checked}
                      onClick={() => {
                        toggleTemplateChannel(channel);
                        if (!checked) setActiveTemplateChannel(channel);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleTemplateChannel(channel);
                          if (!checked) setActiveTemplateChannel(channel);
                        }
                      }}
                      className={[
                        'flex h-[var(--control-height-compact)] items-center gap-2 rounded-full border px-3 py-1 text-left text-xs transition-colors',
                        checked
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-white md:hover:border-white/20',
                      ].join(' ')}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-white">Innehåll per kanal</Label>
                <InfoHint text="Skriv exakt det kunden eller kandidaten ska få i respektive kanal. E-post kan ha rubrik, medan chatt och push fokuserar på ett kortare budskap." />
              </div>
              {templateForm.channels.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-white">Välj minst en kanal för att skapa mallen.</div>
              ) : (
                <div className="space-y-2">
                  {CHANNEL_ORDER.filter((channel) => templateForm.channels.includes(channel)).map((channel) => (
                    <div key={channel} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-white">Kanal: {getOutreachChannelLabel(channel)}</Label>
                      </div>

                      {channel !== 'chat' && (
                        <div className="space-y-2">
                          <Label className="text-white">Rubrik</Label>
                          <Input
                            value={templateForm.channelContent[channel].subject}
                            onFocus={() => setActiveTemplateChannel(channel)}
                            onChange={(e) => setTemplateChannelContent(channel, 'subject', e.target.value)}
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-white">Innehåll</Label>
                        <Textarea
                          value={templateForm.channelContent[channel].body}
                          onFocus={() => setActiveTemplateChannel(channel)}
                          onChange={(e) => setTemplateChannelContent(channel, 'body', e.target.value)}
                          className="min-h-[120px] bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-white">Variabler</p>
                  <InfoHint text="Här visar vi bara stabila variabler som fungerar i vanliga mallar. Intervjudatum, tid, längd och plats/länk hör hemma i själva bokningsflödet och fylls därifrån när en intervju skapas." />
                </div>
                <p className="mt-1 text-[11px] text-white">
                  Tryck på en etikett så läggs den in i vald kanal: {getOutreachChannelLabel(activeTemplateChannel).toLowerCase()}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_EDITOR_VARIABLES.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => {
                      setTemplateForm((prev) => {
                        const targetChannel = prev.channels.includes(activeTemplateChannel)
                          ? activeTemplateChannel
                          : prev.channels[0];

                        if (!targetChannel) return prev;

                        return {
                          ...prev,
                          channelContent: {
                            ...prev.channelContent,
                            [targetChannel]: {
                              ...prev.channelContent[targetChannel],
                              body: `${prev.channelContent[targetChannel].body}{${variable.key}}`,
                            },
                          },
                        };
                      });
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-white transition-colors md:hover:border-white/30 md:hover:text-white"
                  >
                    <span className="block text-[11px] font-medium md:text-xs">{variable.label}</span>
                    <span className="block text-[10px] text-white/70">{`{${variable.key}}`}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="glassBlue" size="sm" className="px-3 text-xs" onClick={handleSaveTemplate} disabled={savingTemplate}>{savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{templateForm.id ? 'Uppdatera mall' : 'Spara mall'}</Button>
              <Button
                variant="glass"
                size="sm"
                className="px-3 text-xs"
                onClick={() => {
                  setTemplateForm(EMPTY_TEMPLATE_FORM);
                  setActiveTemplateChannel('push');
                }}
              >
                Rensa
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="mt-0 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white md:text-base">Regelöversikt</h4>
                <p className="text-xs text-white md:text-sm">Välj vad du vill se och öppna en regel i dropdownen i stället för en lång lista.</p>
              </div>

              <div className="space-y-2">
                <div className="space-y-2">
                  <Label className="text-white">Visa</Label>
                  <Select value={automationVisibilityFilter} onValueChange={(value: AutomationVisibilityFilter) => setAutomationVisibilityFilter(value)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Regel / mall</Label>
                <Select
                  value={selectedTemplateFamilyKey ?? undefined}
                  onValueChange={setSelectedTemplateFamilyKey}
                  disabled={loading || filteredTemplateFamilies.length === 0}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white">
                    <SelectValue placeholder="Välj regel eller mall" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplateFamilies.map((family) => {
                      const ruleState = getAutomationGroupState(getLinkedAutomationGroup(family, automationGroups));
                      return (
                        <SelectItem key={family.key} value={family.key}>
                          {`${family.baseName} · ${ruleState.label}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : templateFamilies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Skapa först en mall under Mallar.</div>
            ) : filteredTemplateFamilies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inget matchar filtret just nu.</div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                {selectedTemplateFamily ? (
                  (() => {
                    const linkedGroup = getLinkedAutomationGroup(selectedTemplateFamily, automationGroups);
                    const ruleState = getAutomationGroupState(linkedGroup);

                    return (
                      <div className="space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="max-w-full truncate text-sm font-semibold text-white">{selectedTemplateFamily.baseName}</p>
                          {selectedTemplateFamily.channels.map((channel) => (
                            <span key={channel} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(channel)}</span>
                          ))}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${ruleState.badgeClassName}`}>{ruleState.label}</span>
                        </div>
                        <p className="text-xs text-white md:text-sm">
                          {linkedGroup
                            ? `Kopplad till ${getOutreachTriggerLabel(linkedGroup.primary.trigger)}`
                            : 'Inte kopplad till tidslinjen ännu'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white">
                          <span>{linkedGroup ? formatAutomationDelay(linkedGroup.primary.delay_minutes) : 'Ingen tid vald ännu'}</span>
                          <span>•</span>
                          <span className={ruleState.key === 'active' ? 'text-green-300' : 'text-white'}>{ruleState.label}</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm text-white">Välj en regel i dropdownen för att visa detaljerna här.</p>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            {!selectedTemplateFamily ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Välj en mall till vänster för att koppla den till tidslinjen.</div>
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-white md:text-base">Koppla mall till tidslinje</h4>
                  <p className="text-xs text-white md:text-sm">Steg 1: välj mall. Steg 2: välj när den ska skickas.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white">Vald mall</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    <p className="max-w-full truncate text-sm font-semibold text-white">{selectedTemplateFamily.baseName}</p>
                    {selectedTemplateFamily.channels.map((channel) => (
                      <span key={channel} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(channel)}</span>
                    ))}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${getAutomationGroupState(selectedAutomationGroup).badgeClassName}`}>
                      {getAutomationGroupState(selectedAutomationGroup).label}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Namn på regeln</Label>
                  <Input value={automationForm.name} onChange={(e) => setAutomationForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">När ska den skickas?</Label>
                  <Select value={automationForm.trigger} onValueChange={(value: AutomationForm['trigger']) => setAutomationForm((prev) => ({ ...prev, trigger: value }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OUTREACH_TRIGGER_OPTIONS.filter((option) => !['manual_send', 'interview_scheduled', 'application_no_response_14d'].includes(option.value)).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">{getDelayFieldLabel(automationForm.trigger)}</Label>
                  <Input type="number" min={0} value={automationForm.delay_minutes} onChange={(e) => setAutomationForm((prev) => ({ ...prev, delay_minutes: Number(e.target.value) || 0 }))} className="bg-white/5 border-white/10 text-white" />
                  <p className="text-[11px] text-white">{getDelayFieldHint(automationForm.trigger)}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white">Kanaler som används</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTemplateFamily.channels.map((channel) => (
                      <span key={channel} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white">{getOutreachChannelLabel(channel)}</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">Aktiv direkt</p>
                    <p className="text-[11px] text-white md:text-xs [overflow-wrap:anywhere]">Stäng av om du vill spara den först och aktivera senare.</p>
                  </div>
                  <Switch checked={automationForm.is_enabled} onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, is_enabled: checked }))} />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="glassBlue" size="sm" className="px-3 text-xs" onClick={handleSaveAutomation} disabled={savingAutomation || !automationFormHasAllTemplates}>{savingAutomation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{automationForm.id ? 'Uppdatera regel' : 'Spara regel'}</Button>
                  {selectedAutomationGroup && (
                    <Button
                      variant="outlineNeutral"
                      size="sm"
                      className="h-9 rounded-full border-destructive/40 bg-destructive/20 px-3 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
                      onClick={() => openDeleteAutomationDialog(selectedAutomationGroup, selectedTemplateFamily)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Ta bort regel
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-0 min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga utskick ännu.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: 'Väntar', value: logSummary.pending },
                  { label: 'Levererat', value: logSummary.delivered },
                  { label: 'Misslyckat', value: logSummary.failed },
                  { label: 'Öppnat', value: logSummary.opened },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
              {logs.map((log) => {
                const template = templates.find((item) => item.id === log.template_id);
                const openedAt = getLogOpenedAt(log);
                return (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachTriggerLabel(log.trigger)}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(log.channel)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${getLogStatusBadgeClassName(log.status)}`}>{getLogStatusLabel(log)}</span>
                    </div>
                    <p className="text-sm font-medium text-white">{template?.name ?? 'Direktutskick'}</p>
                    <p className="text-xs text-white mt-1">{new Date(log.created_at).toLocaleString('sv-SE')}{log.sent_at ? ` · skickad ${new Date(log.sent_at).toLocaleString('sv-SE')}` : ''}</p>
                    {openedAt && <p className="mt-1 text-xs text-white">Öppnad {new Date(openedAt).toLocaleString('sv-SE')}</p>}
                    {log.error_message && <p className="text-sm text-white mt-2">{log.error_message}</p>}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </TooltipProvider>
  );
}
