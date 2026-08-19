import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Mail, Smartphone, Zap, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import SettingsPanel from '@/components/employer/settings/SettingsPanel';
import { AUTO_RULE_CHANNELS, AUTO_RULE_EVENTS, type AutoRuleChannel, type AutoRuleEvent } from '@/lib/outreachAutoRules';
import type { OutreachAutomation, OutreachTemplate } from '@/lib/outreachTypes';

const CHANNEL_ICON: Record<AutoRuleChannel, typeof Mail> = {
  chat: MessageSquare,
  email: Mail,
  push: Smartphone,
};

type PreviewEntry = { channel: AutoRuleChannel; label: string; subject: string | null; body: string; edited: boolean };

function TemplatePreview({ title, entries }: { title: string; entries: PreviewEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={(e) => e.currentTarget.blur()}
          aria-label={`Visa texten som skickas: ${title}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent]"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] max-w-[calc(100vw-2rem)] space-y-3 border-white/10 bg-[#0b1c3a]/95 p-4 backdrop-blur-xl"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-white">Så här lyder texten</p>
        {entries.map((entry) => {
          const Icon = CHANNEL_ICON[entry.channel];
          return (
            <div key={entry.channel} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <Icon className="h-3 w-3 shrink-0" />
                <span>{entry.label}</span>
                {entry.edited && <span className="text-[10px] text-white">· egen text</span>}
              </div>
              {entry.subject && (
                <p className="break-words text-xs text-white">
                  <span className="text-white">Ämne: </span>
                  {entry.subject}
                </p>
              )}
              <p className="whitespace-pre-line break-words text-xs text-white">{entry.body}</p>
            </div>
          );
        })}
        <p className="text-[11px] text-white">
          {'{jobbtitel}, {namn} och {företag} fylls i automatiskt när utskicket skickas.'}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function AutoMessagesPanel() {
  const { user, profile } = useAuth();
  const organizationId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  const [automations, setAutomations] = useState<OutreachAutomation[]>([]);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [automationsRes, templatesRes] = await Promise.all([
      supabase.from('outreach_automations').select('*'),
      supabase.from('outreach_templates').select('*'),
    ]);
    setAutomations((automationsRes.data as OutreachAutomation[]) ?? []);
    setTemplates((templatesRes.data as OutreachTemplate[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`auto-rules-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_automations' }, () => void fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const rowsByTrigger = useMemo(() => {
    const map = new Map<string, OutreachAutomation[]>();
    automations.forEach((automation) => {
      const key = automation.trigger === 'application_no_response_14d' ? 'job_closed' : automation.trigger;
      map.set(key, [...(map.get(key) ?? []), automation]);
    });
    return map;
  }, [automations]);

  const getRow = (event: AutoRuleEvent, channel: AutoRuleChannel) =>
    (rowsByTrigger.get(event.trigger) ?? []).find((automation) => automation.channel === channel) ?? null;

  const getDelay = (event: AutoRuleEvent) => {
    const rows = rowsByTrigger.get(event.trigger) ?? [];
    const enabled = rows.find((row) => row.is_enabled) ?? rows[0];
    return enabled?.delay_minutes ?? event.defaultDelay;
  };

  const ensureTemplateId = async (event: AutoRuleEvent, channel: AutoRuleChannel): Promise<string | null> => {
    const config = event.templates[channel];
    const existing = templates.find((template) => template.name === config.name && template.channel === channel);
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from('outreach_templates')
      .insert({
        owner_user_id: user!.id,
        organization_id: organizationId,
        name: config.name,
        channel,
        subject: config.subject,
        body: config.body,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !data) return null;
    setTemplates((prev) => [...prev, data as OutreachTemplate]);
    return (data as OutreachTemplate).id;
  };

  const handleToggle = async (event: AutoRuleEvent, channel: AutoRuleChannel, enabled: boolean) => {
    if (!user) return;
    const key = `${event.trigger}-${channel}`;
    setBusyKey(key);

    try {
      const existing = getRow(event, channel);

      if (existing) {
        const { error } = await supabase
          .from('outreach_automations')
          .update({ is_enabled: enabled })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        if (!enabled) return;
        const templateId = await ensureTemplateId(event, channel);
        if (!templateId) throw new Error('template');

        const siblings = rowsByTrigger.get(event.trigger) ?? [];
        const groupId =
          (siblings[0]?.filters as { group_id?: string } | null)?.group_id ??
          (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`);

        const { error } = await supabase.from('outreach_automations').insert({
          owner_user_id: user.id,
          organization_id: organizationId,
          name: event.title,
          trigger: event.trigger,
          channel,
          recipient_type: 'candidate',
          template_id: templateId,
          delay_minutes: getDelay(event),
          filters: { group_id: groupId },
          is_enabled: true,
        });
        if (error) throw error;
      }

      await fetchData();
      toast.success(enabled ? 'Automatiskt utskick påslaget' : 'Automatiskt utskick pausat');
    } catch {
      toast.error('Kunde inte spara ändringen');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelayChange = async (event: AutoRuleEvent, value: number) => {
    const rows = rowsByTrigger.get(event.trigger) ?? [];
    if (rows.length === 0) return;

    setBusyKey(`${event.trigger}-delay`);
    const { error } = await supabase
      .from('outreach_automations')
      .update({ delay_minutes: value })
      .in('id', rows.map((row) => row.id));
    setBusyKey(null);

    if (error) {
      toast.error('Kunde inte spara tidpunkten');
      return;
    }
    await fetchData();
  };

  return (
    <SettingsPanel>
      <div className="space-y-5 md:space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Automatiska utskick</h3>
        </div>
        <p className="text-sm text-white">
          Välj vad kandidaten får automatiskt och i vilken kanal. Kandidaten kan alltid stänga av push och mejl i sina
          egna inställningar.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
          </div>
        ) : (
          <div className="space-y-3">
            {AUTO_RULE_EVENTS.map((event) => {
              const delay = getDelay(event);
              const hasAnyRow = (rowsByTrigger.get(event.trigger) ?? []).length > 0;
              const previewEntries: PreviewEntry[] = AUTO_RULE_CHANNELS.map(({ value, label }) => {
                const config = event.templates[value];
                const saved = templates.find((template) => template.name === config.name && template.channel === value);
                return {
                  channel: value,
                  label,
                  subject: saved ? saved.subject : config.subject,
                  body: saved ? saved.body : config.body,
                  edited: Boolean(saved && (saved.body !== config.body || saved.subject !== config.subject)),
                };
              });

              return (
                <div key={event.trigger} className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium text-white">{event.title}</Label>
                        <TemplatePreview title={event.title} entries={previewEntries} />
                      </div>
                      <p className="text-sm text-white">{event.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {AUTO_RULE_CHANNELS.map(({ value, label }) => {
                        const Icon = CHANNEL_ICON[value];
                        const row = getRow(event, value);
                        const key = `${event.trigger}-${value}`;
                        return (
                          <div key={value} className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1 text-xs text-white">
                              <Icon className="h-3 w-3 shrink-0" />
                              <span>{label}</span>
                            </div>
                            <Switch
                              checked={Boolean(row?.is_enabled)}
                              disabled={busyKey === key}
                              onCheckedChange={(checked) => void handleToggle(event, value, checked)}
                              aria-label={`${label}: ${event.title}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-white">{event.delayLabel}</span>
                    <Select
                      value={String(delay)}
                      disabled={!hasAnyRow || busyKey === `${event.trigger}-delay`}
                      onValueChange={(value) => void handleDelayChange(event, Number(value))}
                    >
                      <SelectTrigger className="h-8 w-[180px] border-white/10 bg-white/5 text-xs text-white [&>svg]:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {event.delayOptions.some((option) => option.value === delay)
                          ? null
                          : <SelectItem value={String(delay)}>{`${delay} min`}</SelectItem>}
                        {event.delayOptions.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SettingsPanel>
  );
}

export default AutoMessagesPanel;
