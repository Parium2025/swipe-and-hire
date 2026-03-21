import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type AutomationForm = {
  id: string | null;
  name: string;
  trigger: OutreachTrigger;
  channel: 'chat' | 'email' | 'push';
  recipient_type: 'candidate' | 'employer';
  template_id: string;
  delay_minutes: number;
  is_enabled: boolean;
};

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
  name: '',
  trigger: 'job_closed',
  channel: 'email',
  recipient_type: 'candidate',
  template_id: '',
  delay_minutes: 0,
  is_enabled: true,
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
  const [templateForm, setTemplateForm] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const [automationForm, setAutomationForm] = useState<AutomationForm>(EMPTY_AUTOMATION_FORM);

  const channelTemplates = useMemo(
    () => templates.filter((template) => template.channel === automationForm.channel && template.is_active),
    [templates, automationForm.channel],
  );

  useEffect(() => {
    if (user) void fetchStudio();
  }, [user]);

  useEffect(() => {
    if (!channelTemplates.some((template) => template.id === automationForm.template_id)) {
      setAutomationForm((prev) => ({ ...prev, template_id: channelTemplates[0]?.id ?? '' }));
    }
  }, [channelTemplates, automationForm.template_id]);

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
        toast.error('Kunde inte skapa proffsmallarna');
        setSeeding(false);
        return;
      }
    }

    const { data: freshTemplates, error: templatesError } = await supabase.from('outreach_templates').select('*');
    if (templatesError || !freshTemplates) {
      toast.error('Kunde inte koppla proffssetupen');
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
        toast.error('Mallar skapades men automationerna kunde inte aktiveras');
        setSeeding(false);
        await fetchStudio();
        return;
      }
    }

    toast.success('Proffssetup aktiverad');
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
    if (!user || !automationForm.name.trim() || !automationForm.template_id) return;
    setSavingAutomation(true);

    const payload = {
      owner_user_id: user.id,
      organization_id: organizationId,
      name: automationForm.name.trim(),
      trigger: automationForm.trigger,
      channel: automationForm.channel,
      recipient_type: automationForm.recipient_type,
      template_id: automationForm.template_id,
      delay_minutes: automationForm.delay_minutes,
      filters: {},
      is_enabled: automationForm.is_enabled,
    };

    const query = automationForm.id
      ? supabase.from('outreach_automations').update(payload).eq('id', automationForm.id)
      : supabase.from('outreach_automations').insert(payload);

    const { error } = await query;

    if (error) {
      toast.error('Kunde inte spara automationen');
    } else {
      toast.success(automationForm.id ? 'Automation uppdaterad' : 'Automation skapad');
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

  const handleDeleteAutomation = async (id: string) => {
    const { error } = await supabase
      .from('outreach_automations')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte ta bort automationen');
    } else {
      toast.success('Automation borttagen');
      await fetchStudio();
    }
  };

  const handleToggleAutomation = async (automation: OutreachAutomation, enabled: boolean) => {
    const { error } = await supabase.from('outreach_automations').update({ is_enabled: enabled }).eq('id', automation.id);
    if (error) {
      toast.error('Kunde inte uppdatera automationen');
      return;
    }
    setAutomations((prev) => prev.map((item) => (item.id === automation.id ? { ...item, is_enabled: enabled } : item)));
  };

  const handleRunDispatch = async () => {
    setRunningDispatch(true);
    const { data, error } = await supabase.functions.invoke('outreach-dispatch', { body: { processPending: true } });
    if (error) {
      toast.error('Kunde inte köra väntande utskick');
    } else {
      const count = Number((data as { processedCount?: number } | null)?.processedCount ?? 0);
      toast.success(count > 0 ? `${count} utskick kördes` : 'Inga väntande utskick');
      await fetchStudio();
    }
    setRunningDispatch(false);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white">
            <MessageSquareText className="h-3.5 w-3.5" />
            Outreach Studio
          </div>
          <h3 className="text-lg font-semibold text-white">Professionella mallar, automationer och logg</h3>
          <p className="text-sm text-white">Bygg ditt eget utskickssystem för chat, e-post och push i Parium-stil.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="glassPurple" onClick={seedDefaults} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Aktivera proffssetup
          </Button>
          <Button variant="glassBlue" onClick={handleRunDispatch} disabled={runningDispatch}>
            {runningDispatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Kör väntande utskick
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          { label: 'Mallar', value: templates.length, icon: Bot },
          { label: 'Automationer', value: automations.filter((item) => item.is_enabled).length, icon: RefreshCw },
          { label: 'Väntande', value: logs.filter((item) => item.status === 'pending').length, icon: ScrollText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Icon className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-full border border-white/10 bg-white/5 p-1">
          <TabsTrigger value="templates" className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white">Mallar</TabsTrigger>
          <TabsTrigger value="automations" className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white">Automationer</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white">Logg</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-0 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-white">Mallbibliotek</h4>
                <p className="text-sm text-white">Välj kanal och bygg premiumcopy.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga mallar ännu.</div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{template.name}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(template.channel)}</span>
                          {!template.is_active && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white">Inaktiv</span>}
                        </div>
                        {template.subject && <p className="text-xs text-white">{template.subject}</p>}
                        <p className="line-clamp-2 text-sm text-white">{template.body}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="glass"
                          size="sm"
                          onClick={() => setTemplateForm({
                            id: template.id,
                            name: template.name,
                            channel: template.channel,
                            subject: template.subject ?? '',
                            body: template.body,
                            is_active: template.is_active,
                          })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Redigera
                        </Button>
                        <Button variant="glassRed" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-white">Mallredigerare</h4>
                <p className="text-sm text-white">Använd variabler för att få rätt ton i varje utskick.</p>
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
              <Textarea value={templateForm.body} onChange={(e) => setTemplateForm((prev) => ({ ...prev, body: e.target.value }))} className="min-h-[220px] bg-white/5 border-white/10 text-white" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white">Variabler</p>
              <div className="flex flex-wrap gap-2">
                {OUTREACH_VARIABLES.map((variable) => (
                  <button key={variable.key} type="button" onClick={() => setTemplateForm((prev) => ({ ...prev, body: `${prev.body}{${variable.key}}` }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white hover:border-white/30 hover:text-white">
                    {`{${variable.key}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="glassBlue" onClick={handleSaveTemplate} disabled={savingTemplate}>{savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{templateForm.id ? 'Uppdatera mall' : 'Spara mall'}</Button>
              <Button variant="glass" onClick={() => setTemplateForm(EMPTY_TEMPLATE_FORM)}>Rensa</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="mt-0 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : automations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga automationer ännu.</div>
            ) : (
              <div className="space-y-3">
                {automations.map((automation) => {
                  const linkedTemplate = templates.find((template) => template.id === automation.template_id);
                  return (
                    <div key={automation.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{automation.name}</p>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white">{getOutreachTriggerLabel(automation.trigger)}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(automation.channel)}</span>
                          </div>
                          <p className="text-sm text-white">{linkedTemplate?.name ?? 'Ingen mall vald'} · {getOutreachRecipientLabel(automation.recipient_type)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
                            <span>Aktiv</span>
                            <Switch checked={automation.is_enabled} onCheckedChange={(checked) => void handleToggleAutomation(automation, checked)} />
                          </div>
                          <Button variant="glass" size="sm" onClick={() => setAutomationForm({
                            id: automation.id,
                            name: automation.name,
                            trigger: automation.trigger,
                            channel: automation.channel,
                            recipient_type: automation.recipient_type,
                            template_id: automation.template_id,
                            delay_minutes: automation.delay_minutes,
                            is_enabled: automation.is_enabled,
                          })}><Pencil className="h-3.5 w-3.5" />Redigera</Button>
                          <Button variant="glassRed" size="sm" onClick={() => handleDeleteAutomation(automation.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div>
              <h4 className="text-base font-semibold text-white">Automationsbyggare</h4>
              <p className="text-sm text-white">Koppla rätt mall till rätt trigger och kanal.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Namn</Label>
              <Input value={automationForm.name} onChange={(e) => setAutomationForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white">Trigger</Label>
                <Select value={automationForm.trigger} onValueChange={(value: AutomationForm['trigger']) => setAutomationForm((prev) => ({ ...prev, trigger: value }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_TRIGGER_OPTIONS.filter((option) => option.value !== 'manual_send').map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Kanal</Label>
                <Select value={automationForm.channel} onValueChange={(value: AutomationForm['channel']) => setAutomationForm((prev) => ({ ...prev, channel: value }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_CHANNEL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white">Mottagare</Label>
                <Select value={automationForm.recipient_type} onValueChange={(value: AutomationForm['recipient_type']) => setAutomationForm((prev) => ({ ...prev, recipient_type: value }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTREACH_RECIPIENT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Fördröjning (min)</Label>
                <Input type="number" min={0} value={automationForm.delay_minutes} onChange={(e) => setAutomationForm((prev) => ({ ...prev, delay_minutes: Number(e.target.value) || 0 }))} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Mall</Label>
              <Select value={automationForm.template_id} onValueChange={(value) => setAutomationForm((prev) => ({ ...prev, template_id: value }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue placeholder="Välj mall" /></SelectTrigger>
                <SelectContent>
                  {channelTemplates.length === 0 ? <SelectItem value="__none" disabled>Skapa en mall för denna kanal först</SelectItem> : channelTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Aktivera direkt</p>
                <p className="text-xs text-white">Slå av om du bara vill spara konfigurationen.</p>
              </div>
              <Switch checked={automationForm.is_enabled} onCheckedChange={(checked) => setAutomationForm((prev) => ({ ...prev, is_enabled: checked }))} />
            </div>
            <div className="flex gap-2">
              <Button variant="glassBlue" onClick={handleSaveAutomation} disabled={savingAutomation || !automationForm.template_id}>{savingAutomation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{automationForm.id ? 'Uppdatera automation' : 'Spara automation'}</Button>
              <Button variant="glass" onClick={() => setAutomationForm(EMPTY_AUTOMATION_FORM)}>Rensa</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-0 rounded-3xl border border-white/10 bg-white/5 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white/60">Inga utskick ännu.</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const template = templates.find((item) => item.id === log.template_id);
                return (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">{getOutreachTriggerLabel(log.trigger)}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">{getOutreachChannelLabel(log.channel)}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">{log.status}</span>
                    </div>
                    <p className="text-sm font-medium text-white">{template?.name ?? 'Direktutskick'}</p>
                    <p className="text-xs text-white/55 mt-1">{new Date(log.created_at).toLocaleString('sv-SE')}{log.sent_at ? ` · skickad ${new Date(log.sent_at).toLocaleString('sv-SE')}` : ''}</p>
                    {log.error_message && <p className="text-sm text-white/72 mt-2">{log.error_message}</p>}
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
