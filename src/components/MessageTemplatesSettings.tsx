import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Bot,
  Loader2,
  MessageSquareText,
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

type TemplateForm = {
  id: string | null;
  name: string;
  channel: 'chat' | 'email' | 'push';
  subject: string;
  body: string;
  is_active: boolean;
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

type StudioTab = 'templates' | 'automations' | 'logs';

const EMPTY_TEMPLATE_FORM: TemplateForm = {
  id: null,
  name: '',
  channel: 'chat',
  subject: '',
  body: '',
  is_active: true,
};

const EMPTY_AUTOMATION_FORM: AutomationForm = {
  id: null,
  group_id: null,
  automation_ids: [],
  name: '',
  trigger: 'job_closed',
  channels: ['email'],
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

export function MessageTemplatesSettings() {
  const { user, profile } = useAuth();
  const organizationId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [automations, setAutomations] = useState<OutreachAutomation[]>([]);
  const [logs, setLogs] = useState<OutreachDispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [automationForm, setAutomationForm] = useState<AutomationForm>(EMPTY_AUTOMATION_FORM);

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

  const automationFormHasAllTemplates = automationForm.channels.length > 0 && automationForm.channels.every((channel) => Boolean(automationForm.template_ids[channel]));

  useEffect(() => {
    if (user) void fetchStudio();
  }, [user]);

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

  const fetchStudio = async () => {
    if (!user) return;
    setLoading(true);

    const [templatesRes, automationsRes, logsRes] = await Promise.all([
      supabase.from('outreach_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('outreach_automations').select('*').order('created_at', { ascending: false }),
      supabase.from('outreach_dispatch_logs').select('*').order('created_at', { ascending: false }).limit(40),
    ]);

    if (templatesRes.error || automationsRes.error || logsRes.error) {
      console.error('Error fetching outreach studio:', templatesRes.error || automationsRes.error || logsRes.error);
      toast.error('Kunde inte läsa in Outreach Studio');
    } else {
      setTemplates(templatesRes.data || []);
      setAutomations(automationsRes.data || []);
      setLogs(logsRes.data || []);
    }

    setLoading(false);
  };

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
        await fetchStudio();
        return;
      }
    }

    toast.success('Snabbstart aktiverad');
    setSeeding(false);
    await fetchStudio();
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateForm.name.trim() || !templateForm.body.trim()) return;
    setSavingTemplate(true);

    const payload = {
      owner_user_id: user.id,
      organization_id: organizationId,
      name: templateForm.name.trim(),
      channel: templateForm.channel,
      subject: templateForm.channel === 'chat' ? null : templateForm.subject.trim() || null,
      body: templateForm.body.trim(),
      is_active: templateForm.is_active,
    };

    const query = templateForm.id
      ? supabase.from('outreach_templates').update(payload).eq('id', templateForm.id)
      : supabase.from('outreach_templates').insert({ ...payload, is_default: false });

    const { error } = await query;

    if (error) {
      toast.error('Kunde inte spara mallen');
    } else {
      toast.success(templateForm.id ? 'Mall uppdaterad' : 'Mall skapad');
      setTemplateForm(EMPTY_TEMPLATE_FORM);
      await fetchStudio();
    }

    setSavingTemplate(false);
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
      await fetchStudio();
    }

    setSavingAutomation(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('outreach_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte ta bort mallen');
    } else {
      toast.success('Mall borttagen');
      await fetchStudio();
    }
  };

  const handleDeleteAutomation = async (ids: string[]) => {
    const { error } = await supabase
      .from('outreach_automations')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error('Kunde inte ta bort regeln');
    } else {
      toast.success('Regel borttagen');
      await fetchStudio();
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

  const handleEditAutomationGroup = (group: AutomationGroup) => {
    setAutomationForm({
      id: group.primary.id,
      group_id: group.groupId,
      automation_ids: group.automations.map((automation) => automation.id),
      name: group.primary.name,
      trigger: group.primary.trigger,
      channels: group.channels,
      recipient_type: group.primary.recipient_type,
      template_ids: group.automations.reduce<Partial<Record<AutomationChannel, string>>>((acc, automation) => {
        acc[automation.channel as AutomationChannel] = automation.template_id;
        return acc;
      }, {}),
      delay_minutes: group.primary.delay_minutes,
      is_enabled: group.automations.some((automation) => automation.is_enabled),
    });
  };

  const toggleAutomationChannel = (channel: AutomationChannel, checked: boolean) => {
    setAutomationForm((prev) => ({
      ...prev,
      channels: checked
        ? [...prev.channels, channel].filter((value, index, array) => array.indexOf(value) === index)
        : prev.channels.filter((value) => value !== channel),
    }));
  };

  const handleRunDispatch = async () => {
    setRunningDispatch(true);
    const { data, error } = await supabase.functions.invoke('outreach-dispatch', { body: { processPending: true } });
    if (error) {
      toast.error('Kunde inte skicka väntande utskick');
    } else {
      const count = Number((data as { processedCount?: number } | null)?.processedCount ?? 0);
      toast.success(count > 0 ? `${count} utskick skickades` : 'Inga väntande utskick');
      await fetchStudio();
    }
    setRunningDispatch(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white">
            <MessageSquareText className="h-3 w-3" />
            Outreach Studio
          </div>
          <h3 className="text-sm font-semibold text-white md:text-base">Mallar, regler och utskick</h3>
          <p className="text-xs text-white md:text-sm">Skapa meddelanden och välj när de ska skickas.</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button size="sm" variant="glassPurple" onClick={seedDefaults} disabled={seeding} className="h-[var(--control-height-compact)] px-2.5 text-[11px] md:text-xs">
          {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Kom igång snabbt
          </Button>
          <Button size="sm" variant="glassBlue" onClick={handleRunDispatch} disabled={runningDispatch} className="h-[var(--control-height-compact)] px-2.5 text-[11px] md:text-xs">
            {runningDispatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            Skicka nu
          </Button>
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
                          variant="glass"
                          size="sm"
                            className="h-7 rounded-full px-2 text-[10px] md:text-[11px]"
                          onClick={() => setTemplateForm({
                            id: template.id,
                            name: template.name,
                            channel: template.channel,
                            subject: template.subject ?? '',
                            body: template.body,
                            is_active: template.is_active,
                          })}
                        >
                           <Pencil className="h-2.5 w-2.5" />
                          Redigera
                        </Button>
                        <Button
                          variant="outlineNeutral"
                          size="sm"
                          className="h-7 w-7 rounded-full border-white/10 p-0 text-white transition-colors md:hover:border-destructive/40 md:hover:bg-destructive/20 md:hover:text-destructive"
                          onClick={() => handleDeleteTemplate(template.id)}
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
                <h4 className="text-sm font-semibold text-white md:text-base">Skapa mall</h4>
                <p className="text-xs text-white md:text-sm">Använd variabler för att göra utskicken personliga.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white">
                <span>Aktiv</span>
                <Switch checked={templateForm.is_active} onCheckedChange={(checked) => setTemplateForm((prev) => ({ ...prev, is_active: checked }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Namn</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Kanal</Label>
              <Select value={templateForm.channel} onValueChange={(value: TemplateForm['channel']) => setTemplateForm((prev) => ({ ...prev, channel: value, subject: value === 'chat' ? '' : prev.subject }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTREACH_CHANNEL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {templateForm.channel !== 'chat' && (
              <div className="space-y-2">
                <Label className="text-white">Rubrik</Label>
                <Input value={templateForm.subject} onChange={(e) => setTemplateForm((prev) => ({ ...prev, subject: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white">Innehåll</Label>
              <Textarea value={templateForm.body} onChange={(e) => setTemplateForm((prev) => ({ ...prev, body: e.target.value }))} className="min-h-[144px] bg-white/5 border-white/10 text-white" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2">
                <p className="text-xs uppercase tracking-[0.16em] text-white">Variabler</p>
                <p className="mt-1 text-[11px] text-white/80">Tryck på en etikett så läggs den in automatiskt i texten.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {OUTREACH_VARIABLES.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => setTemplateForm((prev) => ({ ...prev, body: `${prev.body}{${variable.key}}` }))}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-white transition-colors md:hover:border-white/30 md:hover:text-white"
                  >
                    <span className="block text-[11px] font-medium md:text-xs">{variable.label}</span>
                    <span className="block text-[10px] text-white/70">{`{${variable.key}}`}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="glassBlue" size="sm" className="px-3 text-xs" onClick={handleSaveTemplate} disabled={savingTemplate}>{savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{templateForm.id ? 'Uppdatera mall' : 'Spara mall'}</Button>
              <Button variant="glass" size="sm" className="px-3 text-xs" onClick={() => setTemplateForm(EMPTY_TEMPLATE_FORM)}>Rensa</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="mt-0 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : automationGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga regler ännu.</div>
            ) : (
                <div className="space-y-2">
                {automationGroups.map((group) => {
                  const linkedTemplates = group.channels.map((channel) => {
                    const automation = group.automations.find((item) => item.channel === channel);
                    const template = templates.find((item) => item.id === automation?.template_id);
                    return `${getOutreachChannelLabel(channel)}: ${template?.name ?? 'Ingen mall vald'}`;
                  });

                  return (
                    <div key={group.groupId} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="max-w-full truncate text-sm font-semibold text-white">{group.primary.name}</p>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachTriggerLabel(group.primary.trigger)}</span>
                            {group.channels.map((channel) => (
                              <span key={channel} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(channel)}</span>
                            ))}
                          </div>
                          <p className="text-xs text-white md:text-sm">{linkedTemplates.join(' · ')} · {getOutreachRecipientLabel(group.primary.recipient_type)}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <div className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white md:text-[11px]">
                            <span>Aktiv</span>
                            <Switch checked={group.automations.some((automation) => automation.is_enabled)} onCheckedChange={(checked) => void handleToggleAutomation(group, checked)} />
                          </div>
                          <Button variant="glass" size="sm" className="h-7 rounded-full px-2 text-[10px] md:text-[11px]" onClick={() => handleEditAutomationGroup(group)}><Pencil className="h-2.5 w-2.5" />Redigera</Button>
                          <Button
                            variant="outlineNeutral"
                            size="sm"
                            className="h-7 w-7 rounded-full border-white/10 p-0 text-white transition-colors md:hover:border-destructive/40 md:hover:bg-destructive/20 md:hover:text-destructive"
                            onClick={() => handleDeleteAutomation(group.automations.map((automation) => automation.id))}
                          ><Trash2 className="h-2.5 w-2.5" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div>
              <h4 className="text-sm font-semibold text-white md:text-base">Skapa regel</h4>
              <p className="text-xs text-white md:text-sm">Välj när ett meddelande ska skickas och vilken mall som ska användas.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Namn</Label>
              <Input value={automationForm.name} onChange={(e) => setAutomationForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid gap-2">
              <div className="space-y-2">
                <Label className="text-white">När ska det skickas?</Label>
                <Select value={automationForm.trigger} onValueChange={(value: AutomationForm['trigger']) => setAutomationForm((prev) => ({ ...prev, trigger: value }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_TRIGGER_OPTIONS.filter((option) => option.value !== 'manual_send').map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="space-y-2">
                <Label className="text-white">Var ska det skickas?</Label>
                <p className="text-[11px] text-white/80">Välj en eller flera kanaler. Tryck igen för att ta bort.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {OUTREACH_CHANNEL_OPTIONS.map((option) => {
                    const channel = option.value as AutomationChannel;
                    const checked = automationForm.channels.includes(channel);

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleAutomationChannel(channel, !checked)}
                        className={[
                          'flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition-colors',
                          checked
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-white/10 bg-white/5 text-white md:hover:border-white/20',
                        ].join(' ')}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleAutomationChannel(channel, Boolean(value))}
                          className="pointer-events-none"
                        />
                        <span className="font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                {automationForm.channels.length > 0 && (
                  <p className="text-[11px] text-white/80">
                    Valda kanaler: {automationForm.channels.map((channel) => getOutreachChannelLabel(channel)).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="space-y-2">
                <Label className="text-white">Vem ska få det?</Label>
                <Select value={automationForm.recipient_type} onValueChange={(value: AutomationForm['recipient_type']) => setAutomationForm((prev) => ({ ...prev, recipient_type: value }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_RECIPIENT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="space-y-2">
                <Label className="text-white">Väntetid (min)</Label>
                <Input type="number" min={0} value={automationForm.delay_minutes} onChange={(e) => setAutomationForm((prev) => ({ ...prev, delay_minutes: Number(e.target.value) || 0 }))} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Vilken mall ska användas?</Label>
              <div className="space-y-2">
                {automationForm.channels.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">Välj minst en kanal för att koppla mallar.</div>
                ) : (
                  automationForm.channels.map((channel) => {
                    const channelTemplates = activeTemplatesByChannel[channel];

                    return (
                      <div key={channel} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                        <Label className="text-white">Mall för {getOutreachChannelLabel(channel).toLowerCase()}</Label>
                        <Select
                          value={automationForm.template_ids[channel] ?? ''}
                          onValueChange={(value) => setAutomationForm((prev) => ({
                            ...prev,
                            template_ids: {
                              ...prev.template_ids,
                              [channel]: value,
                            },
                          }))}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue placeholder="Välj mall" /></SelectTrigger>
                          <SelectContent>
                            {channelTemplates.length === 0
                              ? <SelectItem value="__none" disabled>Skapa först en mall för {getOutreachChannelLabel(channel).toLowerCase()}</SelectItem>
                              : channelTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Aktiv direkt</p>
                <p className="text-[11px] text-white md:text-xs [overflow-wrap:anywhere]">Stäng av om du vill spara regeln utan att använda den än.</p>
              </div>
              <Switch checked={automationForm.is_enabled} onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, is_enabled: checked }))} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="glassBlue" size="sm" className="px-3 text-xs" onClick={handleSaveAutomation} disabled={savingAutomation || !automationFormHasAllTemplates}>{savingAutomation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{automationForm.id ? 'Uppdatera regel' : 'Spara regel'}</Button>
              <Button variant="glass" size="sm" className="px-3 text-xs" onClick={() => setAutomationForm(EMPTY_AUTOMATION_FORM)}>Rensa</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-0 min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga utskick ännu.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const template = templates.find((item) => item.id === log.template_id);
                return (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachTriggerLabel(log.trigger)}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(log.channel)}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{log.status}</span>
                    </div>
                    <p className="text-sm font-medium text-white">{template?.name ?? 'Direktutskick'}</p>
                    <p className="text-xs text-white mt-1">{new Date(log.created_at).toLocaleString('sv-SE')}{log.sent_at ? ` · skickad ${new Date(log.sent_at).toLocaleString('sv-SE')}` : ''}</p>
                    {log.error_message && <p className="text-sm text-white mt-2">{log.error_message}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
