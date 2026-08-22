import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PillButton } from '@/components/ui/pill-button';
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
  RotateCcw,
  ScrollText,
  Send,
  Trash2,
} from 'lucide-react';
import {
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
import { safeSetItem } from '@/lib/safeStorage';
import { AUTO_RULE_EVENTS } from '@/lib/outreachAutoRules';

// Namn+kanal för samtliga Parium-original (bibliotek + automatiska utskick).
const STANDARD_TEMPLATE_KEYS = new Set<string>([
  ...DEFAULT_OUTREACH_TEMPLATES.map((template) => `${template.name}::${template.channel}`),
  ...AUTO_RULE_EVENTS.flatMap((event) =>
    (Object.entries(event.templates) as Array<[string, { name: string }]>).map(
      ([channel, config]) => `${config.name}::${channel}`,
    ),
  ),
]);

// Alla Parium-original: både biblioteksmallarna och de som Automatiska utskick
// skapar när en kanal slås på. Dessa är låsta och räknas aldrig som "egna mallar".
function isStandardTemplate(template: { name: string; channel: string }) {
  return STANDARD_TEMPLATE_KEYS.has(`${template.name}::${template.channel}`);
}

const TEMPLATE_DRAFT_PREFIX = 'outreach-template-draft:';


type TemplateForm = {
  id: string | null;
  name: string;
  /** Händelsen mallen hör till. En egen mall per händelse + kanal (max 12 slots). */
  trigger: AutoRuleTrigger | '';
  channels: AutomationChannel[];
  channelContent: Record<AutomationChannel, { subject: string; body: string }>;
};

type AutoRuleTrigger = (typeof AUTO_RULE_EVENTS)[number]['trigger'];

type AutomationChannel = 'chat' | 'email' | 'push';

type AutomationForm = {
  id: string | null;
  group_id: string | null;
  automation_ids: string[];
  name: string;
  trigger: OutreachTrigger | '';
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

type StudioTab = 'templates' | 'library' | 'automations' | 'logs';
type AutomationVisibilityFilter = 'all' | 'active' | 'paused' | 'unlinked';

type PendingDeleteAction = {
  kind: 'template' | 'automation' | 'log';
  ids: string[];
  title: string;
  description: string;
  successMessage: string;
  errorMessage: string;
};

type TestRecipient = {
  id: string;
  name: string;
  email: string;
};

/** Visar tooltip endast när innehållet faktiskt är avklippt (overflow). */
function TruncatedTooltip({
  full,
  className,
  style,
  children,
  as = 'p',
}: {
  full: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  as?: 'p' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setOverflowing(el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, style, className]);

  const Tag = as as any;
  const node = (
    <Tag ref={ref as any} className={className} style={style}>
      {children}
    </Tag>
  );

  if (!overflowing) return node;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        className="max-w-[min(420px,calc(100vw-2rem))] border border-white/20 bg-white/10 p-3 text-white backdrop-blur-md"
      >
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-white">{full}</p>
      </TooltipContent>
    </Tooltip>
  );
}

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

/** Röd asterisk tills fältet är ifyllt — då blir den kritvit. */
function RequiredMark({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      className={`text-sm leading-none ${filled ? 'text-white' : 'text-red-400'}`}
    >
      *
    </span>
  );
}

function VariableChips({ channelLabel, onInsert }: { channelLabel: string; onInsert: (token: string) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white">Variabler · {channelLabel}</p>
        <InfoHint text="Tryck på en variabel så läggs den in i texten för just den här kanalen. Värdena fylls i automatiskt när utskicket skickas." />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TEMPLATE_EDITOR_VARIABLES.map((variable) => (
          <button
            key={variable.key}
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onInsert(`{${variable.key}}`)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-transparent bg-white/[0.06] py-1 pl-2.5 pr-1.5 text-white [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none md:transition-colors md:duration-150 md:hover:border-white/25 md:hover:bg-white/[0.1]"
          >
            <span className="text-[11px] font-medium leading-none text-white">{variable.label}</span>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[9.5px] leading-none text-white/75">{`{${variable.key}}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const DELAY_PRESETS = [
  { value: 0, label: 'Direkt' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 tim' },
  { value: 120, label: '2 tim' },
  { value: 1440, label: '1 dygn' },
];

function DelayField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((prev) => (Number(prev) === value ? prev : String(value)));
  }, [value]);

  const commit = (next: number) => {
    const clamped = Math.max(0, Math.min(20160, Math.round(next)));
    setText(String(clamped));
    onChange(clamped);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => commit((Number(text) || 0) - 5)}
          aria-label="Minska med 5 minuter"
          className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 text-white transition-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none md:hover:border-white/30"
        >
          −
        </button>
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={text}
            placeholder="0"
            onChange={(event) => {
              const raw = event.target.value.replace(/[^\d]/g, '');
              setText(raw);
              onChange(raw === '' ? 0 : Math.min(20160, Number(raw)));
            }}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() => commit(Number(text) || 0)}
            className="bg-white/5 border-white/10 text-white text-center"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white">min</span>
        </div>
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => commit((Number(text) || 0) + 5)}
          aria-label="Öka med 5 minuter"
          className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 text-white transition-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none md:hover:border-white/30"
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DELAY_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => commit(preset.value)}
            className={`rounded-full border px-3 py-1 text-[11px] text-white transition-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none ${
              (Number(text) || 0) === preset.value ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5 md:hover:border-white/30'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {(Number(text) || 0) >= 60 && (
        <p className="text-[11px] text-white">Motsvarar {formatAutomationDelay(Number(text) || 0)}</p>
      )}
    </div>
  );
}

const EMPTY_TEMPLATE_FORM: TemplateForm = {
  id: null,
  name: '',
  trigger: '',
  channels: ['push'],
  channelContent: {
    chat: { subject: '', body: '' },
    email: { subject: '', body: '' },
    push: { subject: '', body: '' },
  },
};

// Endast variabler som alltid har ett värde vid automatiska utskick.
// {message} är borttagen — den fylls bara i vid manuella utskick och blev tom i automatiska.
const TEMPLATE_EDITOR_VARIABLES = OUTREACH_VARIABLES.filter((variable) =>
  ['candidate_name', 'first_name', 'company_name', 'job_title'].includes(variable.key),
);

const EMPTY_AUTOMATION_FORM: AutomationForm = {
  id: null,
  group_id: null,
  automation_ids: [],
  name: '',
  trigger: '',
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

const getDelayFieldLabel = (trigger: OutreachTrigger | '') => {
  switch (trigger) {
    case 'interview_before':
      return 'Minuter före intervjun';
    case 'interview_after':
      return 'Minuter efter intervjun';
    default:
      return 'Väntetid (min)';
  }
};

const getDelayFieldHint = (trigger: OutreachTrigger | '') => {
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

const formatAutomationDelay = (minutes: number) => {
  if (!minutes || minutes <= 0) return 'Direkt';
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} dygn`);
  if (hours) parts.push(`${hours} tim`);
  if (mins) parts.push(`${mins} min`);
  return parts.join(' ');
};

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
    case 'retrying': {
      const attempts = (log as { attempt_count?: number | null }).attempt_count ?? 1;
      return `Försöker igen (${attempts}/3)`;
    }
    case 'skipped':
      return 'Hoppades över';
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
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipients, setTestRecipients] = useState<TestRecipient[]>([]);
  const [testRecipientId, setTestRecipientId] = useState<string>('self');
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('library');
  const templatesTabRef = useRef<HTMLButtonElement>(null);
  const libraryTabRef = useRef<HTMLButtonElement>(null);
  const automationsTabRef = useRef<HTMLButtonElement>(null);
  const logsTabRef = useRef<HTMLButtonElement>(null);
  const studioTabsRef = useRef<HTMLDivElement>(null);
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState({ left: 4, width: 0 });
  /**
   * Byter flik och håller flikraden i vy — annars hamnar man kvar längst ner
   * på sidan när nästa steg är kortare än det förra.
   */
  const goToStudioTab = useCallback((tab: StudioTab) => {
    setActiveStudioTab(tab);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        studioTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setTestRecipients([]);
      setTestRecipientId('self');
      return;
    }

    let cancelled = false;
    const loadTestRecipients = async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select('applicant_id, first_name, last_name, email')
        .not('applicant_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (cancelled || error) return;
      const unique = new Map<string, TestRecipient>();
      for (const application of data ?? []) {
        if (!application.applicant_id || unique.has(application.applicant_id)) continue;
        const fullName = `${application.first_name ?? ''} ${application.last_name ?? ''}`.trim();
        unique.set(application.applicant_id, {
          id: application.applicant_id,
          name: fullName || application.email || 'Kandidat',
          email: application.email ?? '',
        });
      }
      setTestRecipients(Array.from(unique.values()));
    };

    void loadTestRecipients();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const templateDraftKey = user ? `${TEMPLATE_DRAFT_PREFIX}${user.id}` : null;

  const [templateForm, setTemplateForm] = useState<TemplateForm>(() => {
    if (!user) return EMPTY_TEMPLATE_FORM;
    try {
      const raw = localStorage.getItem(`${TEMPLATE_DRAFT_PREFIX}${user.id}`);
      if (!raw) return EMPTY_TEMPLATE_FORM;
      const parsed = JSON.parse(raw) as TemplateForm;
      if (!parsed || typeof parsed !== 'object' || !parsed.channelContent || !Array.isArray(parsed.channels)) {
        return EMPTY_TEMPLATE_FORM;
      }
      return { ...EMPTY_TEMPLATE_FORM, ...parsed, channelContent: { ...EMPTY_TEMPLATE_FORM.channelContent, ...parsed.channelContent } };
    } catch {
      return EMPTY_TEMPLATE_FORM;
    }
  });
  const [activeTemplateChannel, setActiveTemplateChannel] = useState<AutomationChannel>('push');
  const [automationForm, setAutomationForm] = useState<AutomationForm>(EMPTY_AUTOMATION_FORM);
  const [automationFormTouched, setAutomationFormTouched] = useState(false);
  const [selectedTemplateFamilyKey, setSelectedTemplateFamilyKey] = useState<string | null>(null);
  const [automationVisibilityFilter, setAutomationVisibilityFilter] = useState<AutomationVisibilityFilter>('all');
  const [pendingDeleteAction, setPendingDeleteAction] = useState<PendingDeleteAction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [expandedTemplateIds, setExpandedTemplateIds] = useState<Set<string>>(new Set());

  

  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [selectedDefaultTemplateName, setSelectedDefaultTemplateName] = useState(DEFAULT_OUTREACH_TEMPLATES[0]?.name ?? '');
  const [restoringDefault, setRestoringDefault] = useState(false);
  const fetchRequestIdRef = useRef(0);
  // Utkastet kan inte hydreras vid första render eftersom `user` sätts asynkront.
  // Vi hydrerar när nyckeln finns och blockerar autospar innan dess, annars
  // skulle det tomma formuläret radera ett sparat utkast direkt vid omladdning.
  const draftHydratedRef = useRef(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    if (!templateDraftKey || draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    try {
      const raw = localStorage.getItem(templateDraftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as TemplateForm;
        if (parsed && typeof parsed === 'object' && parsed.channelContent && Array.isArray(parsed.channels)) {
          setTemplateForm((prev) => {
            const prevTouched =
              prev.name.trim().length > 0 ||
              CHANNEL_ORDER.some(
                (channel) =>
                  prev.channelContent[channel]?.body.trim() || prev.channelContent[channel]?.subject.trim(),
              );
            if (prevTouched) return prev;
            return {
              ...EMPTY_TEMPLATE_FORM,
              ...parsed,
              channelContent: { ...EMPTY_TEMPLATE_FORM.channelContent, ...parsed.channelContent },
            };
          });
        }
      }
    } catch { /* ignore */ }
    setDraftHydrated(true);
  }, [templateDraftKey]);

  // Autospara utkast i mallredigeraren så inget försvinner vid omladdning.
  useEffect(() => {
    if (!templateDraftKey || !draftHydrated) return;
    const hasContent =
      templateForm.name.trim().length > 0 ||
      CHANNEL_ORDER.some(
        (channel) =>
          templateForm.channelContent[channel]?.body.trim() || templateForm.channelContent[channel]?.subject.trim(),
      );
    if (!hasContent) {
      try { localStorage.removeItem(templateDraftKey); } catch { /* ignore */ }
      return;
    }
    safeSetItem(templateDraftKey, JSON.stringify(templateForm));
  }, [templateForm, templateDraftKey, draftHydrated]);



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
      // Parium-standardmallar ska aldrig gå att välja som regel-mall i Steg 2.
      if (STANDARD_TEMPLATE_KEYS.has(`${template.name}::${template.channel}`)) return;
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
      if (log.status === 'pending' || log.status === 'retrying') acc.pending += 1;
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
    // Tomt fält när mallen saknar sparad regel — användaren ska aktivt välja händelse.
    trigger:
      group?.primary.trigger && group.primary.trigger !== 'manual_send'
        ? normalizeTimelineTrigger(group.primary.trigger)
        : '',
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

  // Aktiv kanal härleds vid användning (se effectiveTemplateChannel) i stället för att
  // uppdateras via state när kanaler bockas i/ur – det gav en extra omrendering som
  // syntes som en kort nedtoning av hela glaskortet.


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
      setAutomationFormTouched(false);
      return;
    }

    setAutomationForm(buildAutomationFormFromFamily(selectedTemplateFamily, selectedAutomationGroup));
    setAutomationFormTouched(false);
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

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const refs = {
        templates: templatesTabRef,
        library: libraryTabRef,
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

  // Efter sparad/uppdaterad mall ska redigeraren vara helt blank —
  // inklusive det autosparade utkastet, annars kommer texten tillbaka.
  const resetTemplateEditor = () => {
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setActiveTemplateChannel('push');
    if (templateDraftKey) {
      try { localStorage.removeItem(templateDraftKey); } catch { /* ignore */ }
    }
  };

  // Steg 1 är komplett först när namn, händelse, minst en kanal och all text finns.
  const templateSelectedChannels = CHANNEL_ORDER.filter((channel) => templateForm.channels.includes(channel));
  const templateFormComplete =
    Boolean(templateForm.name.trim()) &&
    Boolean(templateForm.trigger) &&
    templateSelectedChannels.length > 0 &&
    templateSelectedChannels.every((channel) => Boolean(templateForm.channelContent[channel].body.trim()));
  // "Uppdatera mall" bara när sloten (händelse + kanal) redan har en egen mall.
  const templateSlotExists =
    Boolean(templateForm.trigger) &&
    templateSelectedChannels.some((channel) =>
      templates.some(
        (template) =>
          !isStandardTemplate(template) &&
          template.channel === channel &&
          (template.trigger ?? null) === templateForm.trigger,
      ),
    );

  const handleSaveTemplate = async () => {
    if (!user || !templateForm.name.trim() || templateForm.channels.length === 0) return;

    if (!templateForm.trigger) {
      toast.error('Välj vilken händelse mallen gäller');
      return;
    }

    const selectedChannels = CHANNEL_ORDER.filter((channel) => templateForm.channels.includes(channel));
    const missingBody = selectedChannels.some((channel) => !templateForm.channelContent[channel].body.trim());

    if (missingBody) {
      toast.error('Fyll i innehåll för alla valda kanaler');
      return;
    }

    setSavingTemplate(true);

    const trigger = templateForm.trigger as AutoRuleTrigger;
    const baseName = templateForm.name.trim();
    const buildPayload = (channel: AutomationChannel, name: string) => ({
      owner_user_id: user.id,
      organization_id: organizationId,
      name,
      channel,
      trigger,
      subject: channel === 'chat' ? null : templateForm.channelContent[channel].subject.trim() || null,
      body: templateForm.channelContent[channel].body.trim(),
      is_active: true,
      is_default: false,
    });

    // En egen mall per händelse + kanal (max 4 händelser × 3 kanaler = 12).
    // Finns redan en mall i sloten skrivs den över istället för att skapa en dubblett.
    let failed = false;

    for (const channel of selectedChannels) {
      const name = selectedChannels.length > 1 ? `${baseName} · ${getOutreachChannelLabel(channel)}` : baseName;
      const payload = buildPayload(channel, name);

      const slotOwner = templates.find(
        (template) =>
          !isStandardTemplate(template) &&
          template.channel === channel &&
          (template.trigger ?? null) === trigger,
      );
      const targetId =
        slotOwner?.id ??
        (templateForm.id && templates.some((t) => t.id === templateForm.id && t.channel === channel)
          ? templateForm.id
          : null);

      const { error } = targetId
        ? await supabase.from('outreach_templates').update(payload).eq('id', targetId)
        : await supabase.from('outreach_templates').insert(payload);

      if (error) {
        failed = true;
        break;
      }
    }

    if (failed) {
      toast.error('Kunde inte spara mallen');
      setSavingTemplate(false);
      await fetchStudio({ silent: true });
      return;
    }

    setSelectedTemplateFamilyKey(baseName);
    setAutomationVisibilityFilter('all');
    resetTemplateEditor();

    await fetchStudio({ silent: true });
    goToStudioTab('automations');
    toast.success('Mall sparad — steg 2: välj när den ska skickas');

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

    const selectedTrigger = automationForm.trigger;
    if (!selectedTrigger) {
      toast.error('Välj när regeln ska skickas');
      return;
    }

    setSavingAutomation(true);

    const groupId = automationForm.group_id ?? crypto.randomUUID();
    const basePayload = {
      owner_user_id: user.id,
      organization_id: organizationId,
      name: automationForm.name.trim(),
      trigger: selectedTrigger,
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
      // Endast en aktiv regeluppsättning per händelse: tidigare regler för samma händelse stängs av,
      // så kanaler du inte kryssat i slutar skicka direkt.
      let disabledConflicts = 0;
      if (automationForm.is_enabled) {
        const conflicting = automations.filter(
          (automation) =>
            automation.is_enabled &&
            automation.trigger === automationForm.trigger &&
            getAutomationGroupId(automation) !== groupId,
        );


        if (conflicting.length > 0) {
          const { error: conflictError } = await supabase
            .from('outreach_automations')
            .update({ is_enabled: false })
            .in('id', conflicting.map((automation) => automation.id));

          if (!conflictError) disabledConflicts = conflicting.length;
        }
      }

      const wasUpdate = !!automationForm.id;
      toast.success(wasUpdate ? 'Regel uppdaterad' : 'Regel klar — steg 3: följ utskicken under Logg');
      setAutomationFormTouched(false);
      if (disabledConflicts > 0) {
        toast.info(`${disabledConflicts} tidigare regel${disabledConflicts > 1 ? 'er' : ''} för samma händelse stängdes av`);
      }

      if (!wasUpdate) {
        setAutomationForm(EMPTY_AUTOMATION_FORM);
      }
      await fetchStudio({ silent: true });
    }


    setSavingAutomation(false);
  };

  const handleDeleteTemplates = async (requestedIds: string[], successMessage = 'Mall borttagen', errorMessage = 'Kunde inte ta bort mallen') => {
    // Parium-standardmallar är skyddade och kan aldrig raderas.
    const ids = requestedIds.filter((id) => {
      const template = templates.find((item) => item.id === id);
      return template ? !isStandardTemplate(template) : false;
    });

    if (ids.length === 0) {
      toast.info('Parium-standardmallar kan inte tas bort');
      return;
    }

    const linkedAutomationIds = automations
      .filter((automation) => ids.includes(automation.template_id))
      .map((automation) => automation.id);


    if (linkedAutomationIds.length > 0) {
      const { error: automationError } = await supabase
        .from('outreach_automations')
        .delete()
        .in('id', linkedAutomationIds);

      if (automationError) {
        toast.error(errorMessage);
        return;
      }
    }

    const { error } = await supabase
      .from('outreach_templates')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error(errorMessage);
    } else {
      toast.success(successMessage);
      setSelectedTemplateIds((prev) => prev.filter((id) => !ids.includes(id)));
      await fetchStudio({ silent: true });
    }
  };

  const handleDeleteLogs = async (ids: string[], successMessage = 'Loggpost borttagen', errorMessage = 'Kunde inte rensa loggen') => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('outreach_dispatch_logs').delete().in('id', ids);

    if (error) {
      toast.error(errorMessage);
    } else {
      toast.success(successMessage);
      setSelectedLogIds((prev) => prev.filter((id) => !ids.includes(id)));
      setLogs((prev) => prev.filter((log) => !ids.includes(log.id)));
      await fetchStudio({ silent: true });
    }
  };

  const openLogDeleteDialog = (ids: string[], allSelected: boolean) => {
    if (ids.length === 0) return;
    setPendingDeleteAction({
      kind: 'log',
      ids,
      title: allSelected ? 'Rensa loggen' : `Ta bort ${ids.length} loggposter`,
      description: `Är du säker på att du vill ta bort ${ids.length} ${ids.length === 1 ? 'loggpost' : 'loggposter'}? Redan skickade meddelanden påverkas inte – bara historiken här. Denna åtgärd går inte att ångra.`,
      successMessage: `${ids.length} ${ids.length === 1 ? 'loggpost' : 'loggposter'} borttagna`,
      errorMessage: 'Kunde inte rensa loggen',
    });
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
    const linkedRuleCount = automations.filter((automation) => automation.template_id === template.id).length;
    setPendingDeleteAction({
      kind: 'template',
      ids: [template.id],
      title: 'Ta bort mall',
      description: `Är du säker på att du vill ta bort mallen "${template.name}"?${linkedRuleCount > 0 ? ` ${linkedRuleCount} kopplad regel tas också bort.` : ''} Denna åtgärd går inte att ångra.`,
      successMessage: 'Mall borttagen',
      errorMessage: 'Kunde inte ta bort mallen',
    });
  };

  const openBulkDeleteDialog = () => {
    if (selectedTemplateIds.length === 0) return;
    const linkedRuleCount = automations.filter((automation) => selectedTemplateIds.includes(automation.template_id)).length;
    setPendingDeleteAction({
      kind: 'template',
      ids: selectedTemplateIds,
      title: `Ta bort ${selectedTemplateIds.length} mallar`,
      description: `Är du säker på att du vill ta bort alla markerade mallar?${linkedRuleCount > 0 ? ` ${linkedRuleCount} kopplade regler tas också bort.` : ''} Denna åtgärd går inte att ångra.`,
      successMessage: `${selectedTemplateIds.length} mallar borttagna`,
      errorMessage: 'Kunde inte ta bort de markerade mallarna',
    });
  };

  const handleRestoreDefaultTemplate = async (defaultName = selectedDefaultTemplateName) => {
    if (!user) return;
    const defaultTemplate = DEFAULT_OUTREACH_TEMPLATES.find((template) => template.name === defaultName);
    if (!defaultTemplate) return;

    setRestoringDefault(true);
    const existingTemplate = templates.find(
      (template) => template.name === defaultTemplate.name && template.channel === defaultTemplate.channel,
    );
    const payload = {
      name: defaultTemplate.name,
      channel: defaultTemplate.channel,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
      is_active: defaultTemplate.is_active,
      is_default: true,
    };
    const result = existingTemplate
      ? await supabase.from('outreach_templates').update(payload).eq('id', existingTemplate.id)
      : await supabase.from('outreach_templates').insert({
          ...payload,
          owner_user_id: user.id,
          organization_id: organizationId,
        });

    if (result.error) {
      toast.error('Kunde inte återställa Parium-mallen');
    } else {
      toast.success(existingTemplate ? 'Parium-mallen återställd' : 'Parium-mallen tillagd');
      await fetchStudio({ silent: true });
    }
    setRestoringDefault(false);
  };

  // (isStandardTemplate är definierad på modulnivå, se ovan)

  const customTemplates = templates.filter((template) => !isStandardTemplate(template));
  // Kanaler där arbetsgivaren har en egen aktiv mall SOM ÄR KOPPLAD till en påslagen regel.
  // Först då ersätter den egna mallen Parium-standarden. Inaktiverar eller tar du bort
  // mallen – eller stänger av regeln – kommer standardmallen tillbaka automatiskt.
  const activeRuleTemplateIds = new Set(
    automations.filter((automation) => automation.is_enabled).map((automation) => automation.template_id),
  );
  const coveredChannels = new Set(
    customTemplates
      .filter((template) => template.is_active && activeRuleTemplateIds.has(template.id))
      .map((template) => template.channel),
  );
  const standardTemplates = templates.filter(
    (template) => isStandardTemplate(template) && !coveredChannels.has(template.channel),
  );
  const orderedTemplates = [...customTemplates, ...standardTemplates];




  const missingDefaultTemplates = DEFAULT_OUTREACH_TEMPLATES.filter(
    (defaultTemplate) =>
      !templates.some(
        (template) => template.name === defaultTemplate.name && template.channel === defaultTemplate.channel,
      ),
  );

  const restoreTargetName = missingDefaultTemplates.some((item) => item.name === selectedDefaultTemplateName)
    ? selectedDefaultTemplateName
    : missingDefaultTemplates[0]?.name ?? '';



  const handleRestoreAllDefaultTemplates = async () => {
    if (!user || missingDefaultTemplates.length === 0) return;
    setRestoringDefault(true);

    const toInsert = missingDefaultTemplates.map((defaultTemplate) => ({
      name: defaultTemplate.name,
      channel: defaultTemplate.channel,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
      is_active: defaultTemplate.is_active,
      is_default: true,
      owner_user_id: user.id,
      organization_id: organizationId,
    }));

    const { error } = await supabase.from('outreach_templates').insert(toInsert);

    if (error) {
      toast.error('Kunde inte lägga tillbaka Parium-mallarna');
    } else {
      toast.success(`${toInsert.length} Parium-mallar lades tillbaka`);
    }
    await fetchStudio({ silent: true });
    setRestoringDefault(false);
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
        await handleDeleteTemplates(action.ids, action.successMessage, action.errorMessage);
      } else if (action.kind === 'log') {
        await handleDeleteLogs(action.ids, action.successMessage, action.errorMessage);
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

  const handleSendTest = async () => {
    if (!user || !selectedTemplateFamily) return;
    const recipientUserId = testRecipientId === 'self' ? user.id : testRecipientId;
    const recipient = testRecipients.find((candidate) => candidate.id === recipientUserId);

    const sends = selectedTemplateFamily.channels
      .map((channel) => selectedTemplateFamily.templatesByChannel[channel])
      .filter(Boolean)
      .map((template) => ({ channel: template!.channel, templateId: template!.id }));

    if (sends.length === 0) {
      toast.error('Mallen saknar kanaler att testa');
      return;
    }

    setSendingTest(true);
    const { data, error } = await supabase.functions.invoke('outreach-dispatch', {
      body: { mode: 'manual', recipientUserId, sends },
    });
    setSendingTest(false);

    if (error) {
      toast.info('Provutskicket kunde inte skickas — se detaljer i Logg');
      return;
    }

    const channelLabels: Record<string, string> = { chat: 'Chatt', email: 'E-post', push: 'Push' };
    const results = ((data as { results?: Array<{ channel: string; status: string; error?: string }> } | null)?.results) ?? [];
    const sent = results.filter((r) => r.status === 'sent');
    const failed = results.filter((r) => r.status === 'failed');

    if (sent.length > 0) {
      const destination = recipient ? recipient.name : 'dig själv';
      toast.success(`Provutskick skickat till ${destination} (${sent.map((r) => channelLabels[r.channel] ?? r.channel).join(', ')})`);
    } else if (failed.length > 0) {
      toast.info('Provutskicket gick inte igenom — se detaljer i Logg');
    } else {
      toast.info('Inget skickades — mallen saknar innehåll');
    }


    await fetchStudio({ silent: true });
  };


  const handleCreateAutomationShortcut = () => {
    const firstUnlinkedFamily = templateFamilies.find((family) => !getLinkedAutomationGroup(family, automationGroups));

    if (!firstUnlinkedFamily) {
      toast.info('Alla mallar har redan en regel. Välj en befintlig regel i dropdownen för att redigera den.');
      return;
    }

    setAutomationVisibilityFilter('all');
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
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => setPendingDeleteAction(null)}
              className="mt-0 flex-1 rounded-full border-white/20 bg-white/10 text-sm text-white outline-none transition-colors duration-200 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-100 [-webkit-tap-highlight-color:transparent] md:hover:border-white/50 md:hover:bg-white/20 md:hover:text-white"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructiveSoft"
              disabled={isDeleting}
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              className="flex-1 rounded-full text-sm outline-none transition-colors duration-200 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-100 [-webkit-tap-highlight-color:transparent]"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContentNoFocus>
      </AlertDialog>

      <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3.5">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white md:text-base">Mallar, regler och utskick</h3>
          <p className="text-xs text-white md:text-sm">Skapa meddelanden och välj när de ska skickas.</p>
        </div>
      </div>


      <div className="mb-3 grid gap-1.5 md:grid-cols-3">
          {[
          { label: 'Mallar', value: templates.length, icon: Bot },
           { label: 'Aktiva regler', value: automationGroups.filter((group) => group.automations.some((item) => item.is_enabled)).length, icon: RefreshCw },
          { label: 'Väntar på att skickas', value: logs.filter((item) => item.status === 'pending' || item.status === 'retrying').length, icon: ScrollText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] px-2.5 py-1.5">
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

      <Tabs value={activeStudioTab} onValueChange={(value) => goToStudioTab(value as StudioTab)} className="space-y-2.5">
        <div ref={studioTabsRef} className="relative mx-auto flex w-fit gap-0.5 rounded-md border border-white/10 bg-white/5 p-1 scroll-mt-4" role="tablist" aria-label="Outreach sektioner">
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
            ref={libraryTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'library'}
            onClick={() => goToStudioTab('library')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            Mallbibliotek
          </button>
          <button
            ref={templatesTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'templates'}
            onClick={() => goToStudioTab('templates')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            1 · Mall
          </button>
          <button
            ref={automationsTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'automations'}
            onClick={() => goToStudioTab('automations')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            2 · Regel
          </button>
          <button
            ref={logsTabRef}
            type="button"
            role="tab"
            aria-selected={activeStudioTab === 'logs'}
            onClick={() => goToStudioTab('logs')}
            className="relative z-10 rounded-[5px] px-3 py-1 text-xs font-medium text-white whitespace-nowrap"
          >
            3 · Logg
          </button>
        </div>

        <TabsContent value="library" className="mt-0 min-w-0">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white md:text-base">Mallbibliotek</h4>
                <p className="text-xs text-white md:text-sm">Skriv färdiga meddelanden för varje kanal.</p>
              </div>
            </div>

            <div className="mb-3 rounded-2xl border border-white/[0.12] bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">Så fungerar biblioteket</p>
              <ul className="mt-2 space-y-1 text-xs text-white md:text-sm">
                <li>• Mallar märkta <span className="font-semibold">Parium-standard</span> är låsta: de kan varken ändras eller tas bort, så ni har alltid ett fungerande original att falla tillbaka på.</li>
                <li>• Vill du ha egen text: gå till <span className="font-semibold">Steg 1 · Mall</span> och skriv en ny.</li>
                <li>• I <span className="font-semibold">Steg 2 · Regel</span> väljer du händelse (ansökan inkommen, före intervju, efter intervju, annons avslutas) och kanaler. Din regel ersätter direkt tidigare regler för samma händelse och kanal – de äldre stängs av automatiskt, så bara en regel kan skicka per händelse och kanal.</li>
                <li>• Väljer du bara chatt fortsätter e-post och push att vara avstängda för den händelsen tills du kryssar i dem.</li>
              </ul>
            </div>



            {missingDefaultTemplates.length > 0 && (
            <div className="mb-3 grid gap-2 rounded-2xl border border-white/[0.12] bg-white/5 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-white">Parium-standard</Label>
                  <InfoHint text="Parium-standarden finns alltid kvar i koden. Saknas någon originalmall kan du lägga tillbaka den här. När alla finns på plats försvinner rutan. Egna mallar påverkas aldrig." />
                </div>
                <p className="text-xs text-white">
                  {`${missingDefaultTemplates.length} av ${DEFAULT_OUTREACH_TEMPLATES.length} Parium-mallar saknas i biblioteket.`}
                </p>
                <Select
                  value={restoreTargetName}
                  onValueChange={setSelectedDefaultTemplateName}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white">
                    <SelectValue placeholder="Välj Parium-mall" />
                  </SelectTrigger>
                  <SelectContent className="border-white/20 [&_[role=option]+[role=option]]:border-t [&_[role=option]+[role=option]]:border-white/15">
                    {missingDefaultTemplates.map((template) => (
                      <SelectItem key={`${template.channel}-${template.name}`} value={template.name}>{template.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PillButton
                  className="px-4 disabled:opacity-50"
                  disabled={restoringDefault || !restoreTargetName}
                  onClick={() => void handleRestoreDefaultTemplate(restoreTargetName)}
                >
                  {restoringDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Lägg tillbaka vald
                </PillButton>
                {missingDefaultTemplates.length > 1 && (
                  <PillButton
                    className="px-4 disabled:opacity-50"
                    disabled={restoringDefault}
                    onClick={() => void handleRestoreAllDefaultTemplates()}
                  >
                    {restoringDefault ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Lägg tillbaka alla ({missingDefaultTemplates.length})
                  </PillButton>
                )}
              </div>
            </div>
            )}


            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inga mallar ännu.</div>
            ) : (
                <div className="space-y-2">
                {customTemplates.length > 0 && (
                  <>
                    <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">Egna mallar ({customTemplates.length})</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-white">
                        <Checkbox
                          checked={selectedTemplateIds.length === customTemplates.length && customTemplates.length > 0}
                          onCheckedChange={(checked) => setSelectedTemplateIds(checked ? customTemplates.map((template) => template.id) : [])}
                        />
                        Markera alla egna mallar
                      </label>
                      {selectedTemplateIds.length > 0 && (
                        <PillButton
                          className="h-8 border-destructive/40 bg-destructive/20 px-3 hover:bg-destructive/30 hover:border-destructive/60"
                          onClick={openBulkDeleteDialog}
                        >
                          <Trash2 className="h-3 w-3" />
                          Ta bort markerade ({selectedTemplateIds.length})
                        </PillButton>
                      )}
                    </div>
                  </>
                )}
                {orderedTemplates.map((template, index) => {
                  const isStandard = isStandardTemplate(template);
                  const showStandardHeading = isStandard && index === customTemplates.length;
                  return (
                    <div key={template.id} className="contents">
                    {showStandardHeading && (
                      <div className="px-1 pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">Parium-standard ({standardTemplates.length})</p>
                        <p className="mt-1 text-[11px] text-white md:text-xs">Låsta originalmallar. De läggs till automatiskt när du slår på en kanal under Automatiska utskick – de är alltså inga nya egna mallar.</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-2">

                    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {!isStandard && (
                            <Checkbox
                              checked={selectedTemplateIds.includes(template.id)}
                              onCheckedChange={(checked) => setSelectedTemplateIds((prev) => checked ? [...new Set([...prev, template.id])] : prev.filter((id) => id !== template.id))}
                              aria-label={`Markera ${template.name}`}
                            />
                          )}
                          <TruncatedTooltip
                            as="span"
                            full={template.name}
                            className="block min-w-0 flex-[1_1_12rem] cursor-default truncate text-base font-semibold text-white"
                          >
                            {template.name}
                          </TruncatedTooltip>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(template.channel)}</span>
                          {isStandard && <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">Parium-standard</span>}
                          {!template.is_active && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">Inaktiv</span>}
                          {!isStandard && template.trigger && (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">
                              {AUTO_RULE_EVENTS.find((event) => event.trigger === template.trigger)?.title ?? getOutreachTriggerLabel(template.trigger)}
                            </span>
                          )}
                          {!isStandard && !template.trigger && (
                            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">Ingen händelse</span>
                          )}

                        </div>
                        {(() => {
                          const isExpanded = expandedTemplateIds.has(template.id);
                          const normalizedBody = (template.body ?? '').replace(/\s+/g, ' ').trim();
                          const normalizedSubject = (template.subject ?? '').replace(/\s+/g, ' ').trim();
                          const needsExpand = normalizedBody.length > 90 || (template.body ?? '').includes('\n') || normalizedSubject.length > 90;
                          const collapsedTextStyle = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as const;
                          return (
                            <div className="space-y-1">
                              {normalizedSubject && (
                                <TruncatedTooltip
                                  full={template.subject ?? ''}
                                  className="cursor-default break-words text-[11px] text-white md:text-xs"
                                  style={isExpanded ? undefined : collapsedTextStyle}
                                >
                                  {normalizedSubject}
                                </TruncatedTooltip>
                              )}
                              <p
                                className="break-words text-xs text-white"
                                style={isExpanded ? undefined : collapsedTextStyle}
                              >
                                {normalizedBody}
                              </p>
                              {needsExpand && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedTemplateIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(template.id)) next.delete(template.id);
                                      else next.add(template.id);
                                      return next;
                                    });
                                  }}
                                  className="text-xs text-white underline-offset-2 hover:underline"
                                >
                                  {isExpanded ? 'Visa mindre' : 'Visa hela texten'}
                                </button>
                              )}
                            </div>
                          );
                        })()}



                        {isStandard && (
                          <p className="text-[11px] text-white md:text-xs">Skyddad originalmall – kan inte ändras eller tas bort. Vill du ha egen text skapar du en ny mall i Steg 1.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {isStandard ? null : (

                          <>
                            <PillButton
                              shape="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                // Äldre mallar saknar händelse (kolumnen är ny). Härled den från
                                // regeln som använder mallen, annars faller vi tillbaka på ansökan.
                                const inferredTrigger =
                                  (template.trigger as AutoRuleTrigger | null) ??
                                  (automations.find((automation) => automation.template_id === template.id)
                                    ?.trigger as AutoRuleTrigger | undefined) ??
                                  ('application_received' as AutoRuleTrigger);
                                setTemplateForm({
                                  id: template.id,
                                  name: template.name,
                                  trigger: inferredTrigger,
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
                                });
                                setActiveTemplateChannel(template.channel as AutomationChannel);
                                goToStudioTab('templates');
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </PillButton>

                            <PillButton
                              shape="icon"
                              className="h-8 w-8 border-destructive/40 bg-destructive/20 hover:bg-destructive/30 hover:border-destructive/60"
                              onClick={() => openDeleteTemplateDialog(template)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </PillButton>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                  );

                })}
              </div>
            )}

          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-0 min-w-0">
          <div className="min-w-0 space-y-3 rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white md:text-base">Steg 1 · Skapa mall</h4>
                  <InfoHint text="Här bygger du grunden för automatiska eller manuella utskick. Börja med namn, välj kanaler och skriv sedan innehåll per kanal." />
                </div>
                <p className="text-xs text-white md:text-sm">Här skriver du bara texten — när den ska skickas väljer du i steg 2. Variablerna fylls i automatiskt per kandidat. Ditt utkast sparas automatiskt, även om du laddar om sidan.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-white">Namn</Label>
                <RequiredMark filled={Boolean(templateForm.name.trim())} />
                <InfoHint text="Ge mallen ett tydligt namn som gör det lätt att förstå när den ska användas, till exempel 'Intervju bokad' eller 'Avslutad annons'." />
              </div>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-white">Händelse</Label>
                <RequiredMark filled={Boolean(templateForm.trigger)} />
                <InfoHint text="Varje händelse kan ha en egen mall per kanal – totalt max 12. Väljer du en händelse och kanal där du redan har en egen mall skrivs den mallen över, så det aldrig blir dubbletter." />
              </div>
              <Select
                value={templateForm.trigger || undefined}
                onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, trigger: value as AutoRuleTrigger }))}
              >
                <SelectTrigger className={`bg-white/5 text-white ${templateForm.trigger ? 'border-white/10' : 'border-red-400/40'}`}>
                  <SelectValue placeholder="Välj händelse" />
                </SelectTrigger>
                <SelectContent>
                  {AUTO_RULE_EVENTS.map((event) => (
                    <SelectItem key={event.trigger} value={event.trigger}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateForm.trigger && (
                <p className="text-[11px] text-white md:text-xs">
                  {CHANNEL_ORDER.filter((channel) => templateForm.channels.includes(channel)).some((channel) =>
                    templates.some(
                      (template) =>
                        !isStandardTemplate(template) &&
                        template.channel === channel &&
                        (template.trigger ?? null) === templateForm.trigger,
                    ),
                  )
                    ? 'Du har redan en egen mall för den här händelsen och kanalen – den skrivs över när du sparar.'
                    : 'Mallen ersätter Parium-standard för den här händelsen och kanalen.'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-white">Kanaler</Label>
                <RequiredMark filled={templateForm.channels.length > 0} />
                <InfoHint text="Välj var meddelandet ska kunna skickas. Om du väljer flera kanaler skapas en version per kanal som du kan anpassa separat." />
              </div>
              <p className="text-[11px] text-white">Väljer du flera kanaler kopieras texten automatiskt till de tomma kanalerna — du kan sedan justera varje kanal för sig.</p>
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
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleTemplateChannel(channel);
                        }
                      }}

                      className={[
                        'flex h-[var(--control-height-compact)] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-left text-xs text-white',
                        'transition-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none',
                        'md:hover:border-white/20',
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
                    <div key={channel} className="space-y-2 rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
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
                        <div className="flex items-center gap-2">
                          <Label className="text-white">Innehåll</Label>
                          <RequiredMark filled={Boolean(templateForm.channelContent[channel].body.trim())} />
                        </div>
                        <Textarea
                          value={templateForm.channelContent[channel].body}
                          onFocus={() => setActiveTemplateChannel(channel)}
                          onChange={(e) => setTemplateChannelContent(channel, 'body', e.target.value)}
                          className="min-h-[120px] bg-white/5 border-white/10 text-white"
                        />
                      </div>

                      <VariableChips
                        channelLabel={getOutreachChannelLabel(channel)}
                        onInsert={(token) =>
                          setTemplateChannelContent(channel, 'body', `${templateForm.channelContent[channel].body}${token}`)
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <PillButton className="px-4 border-primary/40 bg-primary/25 hover:bg-primary/35 hover:border-primary/60 disabled:opacity-50" onClick={handleSaveTemplate} disabled={savingTemplate || !templateFormComplete}>{savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{templateSlotExists ? 'Uppdatera mall' : 'Skapa mall'}</PillButton>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="automations" className="mt-0 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
            <div className="mb-3 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white md:text-base">Steg 2 · Bestäm när mallen ska skickas</h4>
                <p className="text-xs text-white md:text-sm">En mall är bara text. Först när du ger den en regel här skickas den — automatiskt, utan att du gör något.</p>
              </div>

              <div className="rounded-2xl border border-white/[0.12] bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white">Så funkar det</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-white">
                  <li><strong className="font-semibold">Mall</strong> = texten (steg 1). <strong className="font-semibold">Regel</strong> = när texten skickas (steg 2).</li>
                  <li>Välj en mall nedan, välj händelse (t.ex. "Ansökan inkommen") och tid — spara.</li>
                  <li>Kontrollera under <strong className="font-semibold">3 · Logg</strong> att utskicket gick fram.</li>
                </ol>
                <p className="mt-2 text-[11px] text-white">
                  Statusen bakom varje mall: <strong className="font-semibold">Aktiv</strong> = skickas automatiskt. <strong className="font-semibold">Pausad</strong> = regel finns men är avstängd. <strong className="font-semibold">Ingen regel</strong> = mallen ligger bara sparad och skickas aldrig.
                </p>
                <p className="mt-2 text-[11px] text-white">
                  Mallar som heter t.ex. "Jobb avslutat · professionellt mejl" är Pariums färdiga startmallar från "Kom igång snabbt" — de fungerar precis som dina egna och går att ändra eller ta bort.
                </p>
              </div>






              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-white">Vilken mall vill du sätta en regel på?</Label>
                  <InfoHint text="Välj mallen du nyss skapade (den ligger med ditt namn på). Statusen efter namnet visar om den redan skickas." />
                </div>
                <Select
                  value={selectedTemplateFamilyKey ?? undefined}
                  onValueChange={setSelectedTemplateFamilyKey}
                  disabled={loading || filteredTemplateFamilies.length === 0}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white">
                    <SelectValue placeholder="Välj regel eller mall" />
                  </SelectTrigger>
                  <SelectContent className="border-white/20 [&_[role=option]+[role=option]]:border-t [&_[role=option]+[role=option]]:border-white/15">
                    {filteredTemplateFamilies.map((family) => {
                      const linkedGroup = getLinkedAutomationGroup(family, automationGroups);
                      const isSelected = family.key === selectedTemplateFamilyKey;
                      const ruleState = getAutomationGroupState(linkedGroup);
                      // Vald mall speglar formuläret direkt: "Test 1 · Ansökan inkommen".
                      const liveLabel = isSelected && automationForm.trigger
                        ? `${getOutreachTriggerLabel(automationForm.trigger)}${automationFormTouched ? ' (ej sparad)' : ''}`
                        : isSelected && automationFormTouched
                          ? 'Ej sparad'
                          : ruleState.label;
                      return (
                        <SelectItem key={family.key} value={family.key}>
                          {`${family.baseName} · ${liveLabel}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></div>
            ) : templateFamilies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Skapa först en mall under fliken Mall.</div>
            ) : filteredTemplateFamilies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Inget stämmer med filtret just nu.</div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3 rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
            {!selectedTemplateFamily ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white">Välj en mall till vänster för att koppla den till tidslinjen.</div>
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-white md:text-base">Sätt regel på mallen</h4>
                  <p className="text-xs text-white md:text-sm">Välj händelsen som ska trigga utskicket, sätt tiden och spara — då blir mallen aktiv.</p>
                </div>

                <div className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white">Vald mall</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                    <p className="max-w-full truncate text-sm font-semibold text-white">{selectedTemplateFamily.baseName}</p>
                    {selectedTemplateFamily.channels.map((channel) => (
                      <span key={channel} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white">{getOutreachChannelLabel(channel)}</span>
                    ))}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${automationForm.trigger ? (automationFormTouched ? 'border-amber-400/30 bg-amber-400/15 text-white' : getAutomationGroupState(selectedAutomationGroup).badgeClassName) : 'border-white/10 bg-white/5 text-white'}`}>
                      {automationForm.trigger
                        ? `${getOutreachTriggerLabel(automationForm.trigger)}${automationFormTouched ? ' · ej sparad' : ''}`
                        : 'Ingen regel vald'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white md:text-sm">
                    {automationForm.trigger
                      ? `Skickas vid ${getOutreachTriggerLabel(automationForm.trigger)} · ${formatAutomationDelay(automationForm.delay_minutes)}`
                      : 'Välj händelse nedan för att sätta regeln.'}
                  </p>
                  {selectedAutomationGroup &&
                    (selectedAutomationGroup.primary.trigger !== automationForm.trigger ||
                      selectedAutomationGroup.primary.delay_minutes !== automationForm.delay_minutes) && (
                      <p className="mt-1 text-[11px] text-white [overflow-wrap:anywhere]">
                        {`Sparad regel just nu: ${getOutreachTriggerLabel(selectedAutomationGroup.primary.trigger)} · ${formatAutomationDelay(selectedAutomationGroup.primary.delay_minutes)} — spara för att uppdatera.`}
                      </p>
                    )}
                  {!selectedAutomationGroup && (
                    <p className="mt-1 text-[11px] text-white">Inte kopplad till tidslinjen ännu — spara regeln för att aktivera.</p>
                  )}

                </div>


                <div className="space-y-2">
                  <Label className="text-white">Namn på regeln</Label>
                  <Input value={automationForm.name} onChange={(e) => { setAutomationFormTouched(true); setAutomationForm((prev) => ({ ...prev, name: e.target.value })); }} className="bg-white/5 border-white/10 text-white" />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">När ska den skickas?</Label>
                  <Select value={automationForm.trigger || undefined} onValueChange={(value: AutomationForm['trigger']) => { setAutomationFormTouched(true); setAutomationForm((prev) => ({ ...prev, trigger: value })); }}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white"><SelectValue placeholder="Välj händelse" /></SelectTrigger>
                    <SelectContent className="border-white/20 [&_[role=option]+[role=option]]:border-t [&_[role=option]+[role=option]]:border-white/15">
                      {OUTREACH_TRIGGER_OPTIONS.filter((option) => !['manual_send', 'interview_scheduled', 'application_no_response_14d'].includes(option.value)).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">{getDelayFieldLabel(automationForm.trigger)}</Label>
                  <DelayField value={automationForm.delay_minutes} onChange={(next) => { setAutomationFormTouched(true); setAutomationForm((prev) => ({ ...prev, delay_minutes: next })); }} />
                  <p className="text-[11px] text-white">{getDelayFieldHint(automationForm.trigger)}</p>
                </div>

                <div className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-white">Kanaler som används</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTemplateFamily.channels.map((channel) => (
                      <span key={channel} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white">{getOutreachChannelLabel(channel)}</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">Aktiv direkt</p>
                    <p className="text-[11px] text-white md:text-xs [overflow-wrap:anywhere]">Stäng av om du vill spara den först och aktivera senare.</p>
                  </div>
                  <Switch checked={automationForm.is_enabled} onCheckedChange={(checked) => { setAutomationFormTouched(true); setAutomationForm((prev) => ({ ...prev, is_enabled: checked })); }} />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Provutskick till</Label>
                  <Select value={testRecipientId} onValueChange={setTestRecipientId}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white [&>svg]:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/20">
                      <SelectItem value="self">Mig själv</SelectItem>
                      {testRecipients.map((recipient) => (
                        <SelectItem key={recipient.id} value={recipient.id}>
                          {recipient.name}{recipient.email ? ` · ${recipient.email}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-white">Endast kandidater som redan har sökt ett av era jobb kan väljas.</p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <PillButton
                    className="px-4 border-primary/40 bg-primary/25 hover:bg-primary/35 hover:border-primary/60 disabled:opacity-50"
                    onClick={handleSaveAutomation}
                    disabled={savingAutomation || !automationFormHasAllTemplates || !automationForm.trigger}
                  >
                    {savingAutomation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {automationForm.id ? 'Uppdatera regel' : 'Spara regel'}
                  </PillButton>
                  <PillButton
                    className="px-4 border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 disabled:opacity-50"
                    onClick={handleSendTest}
                    disabled={sendingTest}
                  >
                    {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Skicka provutskick
                  </PillButton>
                  {selectedAutomationGroup && (
                    <PillButton
                      className="px-4 border-destructive/40 bg-destructive/20 hover:bg-destructive/30 hover:border-destructive/60"
                      onClick={() => openDeleteAutomationDialog(selectedAutomationGroup, selectedTemplateFamily)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Ta bort regel
                    </PillButton>
                  )}
                </div>
                <p className="text-center text-[11px] text-white">
                  Du kan testa direkt utan att spara. Provutskicket går bara till dig själv och aktiverar inte regeln.
                </p>


              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-0 min-w-0 rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-3">
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
                  <div key={item.label} className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                <label className="flex cursor-pointer items-center gap-2 px-1 text-xs font-medium text-white">
                  <Checkbox
                    checked={selectedLogIds.length === logs.length && logs.length > 0}
                    onCheckedChange={(checked) => setSelectedLogIds(checked ? logs.map((log) => log.id) : [])}
                  />
                  Markera alla ({logs.length})
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedLogIds.length > 0 && (
                    <PillButton
                      className="h-8 border-destructive/60 bg-destructive/30 px-3 text-white hover:bg-destructive/45 hover:border-destructive/80"
                      onClick={() => openLogDeleteDialog(selectedLogIds, selectedLogIds.length === logs.length)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Ta bort ({selectedLogIds.length})
                    </PillButton>
                  )}
                </div>
              </div>

              <p className="px-1 text-[11px] text-white">
                Loggen städas automatiskt: poster äldre än 90 dagar tas bort varje natt.
              </p>


              <div className="space-y-2">
              {logs.map((log) => {
                const template = templates.find((item) => item.id === log.template_id);
                const openedAt = getLogOpenedAt(log);
                return (
                  <div key={log.id} className="rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] p-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Checkbox
                        checked={selectedLogIds.includes(log.id)}
                        onCheckedChange={(checked) => setSelectedLogIds((prev) => checked ? [...new Set([...prev, log.id])] : prev.filter((id) => id !== log.id))}
                        aria-label="Markera loggpost"
                      />
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
