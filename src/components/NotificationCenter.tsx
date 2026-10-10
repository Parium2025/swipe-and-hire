import { memo, useState, useRef, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { CountBadge } from '@/components/ui/count-badge';
import { Bell, Trash2, Briefcase, UserCheck, Calendar, MessageCircle, UserX, CheckCircle2, AlertTriangle, Info, XCircle, ThumbsUp } from 'lucide-react';
import { toastArchive, type ArchivedToast } from '@/lib/toastArchive';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { useNotificationPreferences, type NotificationType } from '@/hooks/useNotificationPreferences';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const typeIcons: Record<string, typeof Bell> = {
  new_application: UserCheck,
  candidate_shared: UserCheck,
  application_status: Briefcase,
  interview_scheduled: Calendar,
  message: MessageCircle,
  new_message: MessageCircle,
  chat_message: MessageCircle,
  job_expired: Briefcase,
  saved_search_match: Bell,
  candidate_deleted: UserX,
  message_reaction: ThumbsUp,
};


const typeColors: Record<string, string> = {
  new_application: 'text-white',
  application_status: 'text-white',
  interview_scheduled: 'text-white',
  message: 'text-white',
  new_message: 'text-white',
  chat_message: 'text-white',
  job_expired: 'text-white',
  saved_search_match: 'text-white',
  candidate_deleted: 'text-white',
  message_reaction: 'text-white',
};


/**
 * Visar hela texten i en tooltip när notistexten är klippt.
 * Trunkeringen mäts i samma ögonblick som muspekaren når texten – då är layouten
 * garanterat stabil, vilket gör detektionen 100 % tillförlitlig (till skillnad från
 * att mäta vid montering, där panelens öppningsanimation kan ge fel värde).
 */
// På touch finns ingen hovring — där fäller ett tryck i stället ut hela texten
// direkt i raden (se `expanded`), så tooltipen används bara med mus/styrplatta.
const CAN_HOVER =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : true;

function ClampTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  if (!CAN_HOVER) return <>{children}</>;

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        if (!next) { setOpen(false); return; }
        const el = ref.current;
        const clipped = !!el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
        setOpen(clipped);
      }}
      disableHoverableContent
    >
      <TooltipTrigger asChild ref={ref as unknown as React.Ref<HTMLButtonElement>}>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[280px] whitespace-pre-wrap break-words text-xs leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const EXPAND_SPRING = { type: 'spring' as const, stiffness: 420, damping: 40, mass: 0.9 };

// Raden tonar mjukt ner till "läst" i stället för att hoppa.
const ROW_TRANSITION = {
  y: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  opacity: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};
const ROW_CLASS =
  'w-full flex items-start gap-5 px-5 py-5 text-left transition-colors duration-150 cursor-pointer select-none [-webkit-tap-highlight-color:transparent] active:bg-white/[0.06] pointer-fine:hover:bg-white/5';

/** Röd oläst-prick som krymper bort mjukt när notisen läses. */
function UnreadDot({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.span
          key="dot"
          aria-hidden="true"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
          className="shrink-0 h-2 w-2 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm shadow-red-500/30"
        />
      )}
    </AnimatePresence>
  );
}

/**
 * Två rader med ellips som mjukt fälls ut till hela texten när raden trycks —
 * samma känsla som när en notis expanderas på iPhone. Höjden animeras mellan
 * uppmätta värden; ellipsen ligger kvar tills texten är helt ihopfälld igen.
 */
function ExpandableClamp({
  expanded,
  className,
  children,
}: {
  expanded: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);

  useLayoutEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const unclamp = () => {
      inner.style.setProperty('-webkit-line-clamp', 'unset');
      inner.style.display = 'block';
      inner.style.overflow = 'visible';
    };
    const clamp = () => {
      inner.style.removeProperty('-webkit-line-clamp');
      inner.style.display = '';
      inner.style.overflow = '';
    };

    const from = outer.getBoundingClientRect().height;
    let to: number;
    if (expanded) {
      unclamp();
      to = inner.getBoundingClientRect().height;
    } else {
      clamp();
      to = inner.getBoundingClientRect().height;
      unclamp();
    }
    if (Math.abs(to - from) < 1) {
      if (!expanded) clamp();
      return;
    }

    outer.style.overflow = 'hidden';
    outer.style.height = `${from}px`;
    const controls = animate(outer, { height: [from, to] }, EXPAND_SPRING);
    controls.then(() => {
      outer.style.height = '';
      outer.style.overflow = '';
      if (!expanded) clamp();
    });
    return () => controls.stop();
  }, [expanded]);

  return (
    <div ref={outerRef}>
      <div ref={innerRef} className={`${className} line-clamp-2`}>{children}</div>
    </div>
  );
}



// Notiser saknar ofta en explicit route i metadata (t.ex. chattnotiser som bara
// bär conversation_id). Här härleds målet så att varje notis alltid går att klicka på.
function resolveRoute(type: string, metadata?: Record<string, unknown> | null): string | undefined {
  const explicit = typeof metadata?.route === 'string' ? metadata.route : undefined;
  // Äldre återkopplingspåminnelser pekade på en sida som inte finns ("/employer").
  if (type === 'followup_reminder') {
    // Öppnar just den kandidaten ovanpå sidan man står på (?-länk behåller sidan).
    const appId = typeof metadata?.application_id === 'string' ? metadata.application_id : undefined;
    const intId = typeof metadata?.interview_id === 'string' ? metadata.interview_id : undefined;
    if (appId) return `?open_application=${appId}`;
    if (intId) return `?open_interview=${intId}`;
    return '/my-candidates';
  }
  if (explicit) return explicit;

  const conversationId = metadata?.conversation_id;
  if (typeof conversationId === 'string' && conversationId) {
    return `/messages?conversation=${conversationId}`;
  }

  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const jobId = str(metadata?.job_id);
  const applicationId = str(metadata?.application_id) ?? str(metadata?.job_application_id);
  const candidateId = str(metadata?.candidate_id) ?? str(metadata?.applicant_id);
  const interviewId = str(metadata?.interview_id);
  const ticketId = str(metadata?.ticket_id) ?? str(metadata?.support_ticket_id);

  switch (type) {
    case 'message':
    case 'new_message':
      return '/messages';
    case 'new_application':
      if (applicationId) return `/candidates?application=${applicationId}`;
      return jobId ? `/job-details/${jobId}` : '/candidates';
    case 'application_status':
      return applicationId ? `/my-applications?application=${applicationId}` : '/my-applications';
    case 'interview_scheduled':
      if (interviewId) return `/my-candidates?interview=${interviewId}`;
      return candidateId ? `/my-candidates?candidate=${candidateId}` : '/my-candidates';
    // Intervjupåminnelser ("Intervju om 10 minuter") saknar ett meningsfullt mål
    // och ska inte gå att trycka på – de är bara information.
    case 'interview_reminder':
      return undefined;
    case 'job_expired':
    case 'job_closed':
      return jobId ? `/job-details/${jobId}` : '/my-jobs';
    case 'support_reply':
    case 'support_message':
      return ticketId ? `/support?ticket=${ticketId}` : '/support';
    case 'saved_search_match':
      return '/search-jobs';
    case 'saved_job_expiring':
      return '/saved-jobs';
    default:
      return undefined;
  }
}

// Äldre arkiverade toaster saknar `route` (de skapades innan notiserna blev
// klickbara). Här härleds målet från titeln så att även historiken går att
// klicka på – inget "händer ingenting" på gamla notiser.
const TOAST_ROUTE_RULES: Array<[RegExp, string]> = [
  [/utkast (sparat|uppdaterat|sparad)/i, '/my-jobs?tab=draft'],
  [/annons(en)? (publicerad|återpublicerad|uppdaterad|skapad)/i, '/my-jobs'],
  [/jobbannons/i, '/my-jobs'],
  [/ansökan skickad/i, '/my-applications'],
  [/intervju (bokad|ombokad|inbokad|flyttad)/i, '/my-candidates'],
  [/kandidat (tillagd|flyttad|sparad)/i, '/my-candidates'],
  [/meddelande(n)? (skickat|skickade|köat)/i, '/messages'],
  [/profil(en)? (uppdaterad|sparad)/i, '/profile'],
  [/supportärende|supportmeddelande/i, '/support'],
  [/sparade jobb synkroniserade|jobb sparat/i, '/saved-jobs'],
];

// Felnotiser ("Kunde inte spara annonsen") ska aldrig navigera någonstans.
const FAILURE_PATTERN = /kunde inte|misslyckades|gick inte|fel vid|något gick fel/i;

function resolveToastRoute(title: string, body?: string | null): string | undefined {
  const text = `${title} ${body ?? ''}`;
  if (FAILURE_PATTERN.test(text)) return undefined;
  for (const [pattern, route] of TOAST_ROUTE_RULES) {
    if (pattern.test(text)) return route;
  }
  return undefined;
}

// Notiser som handlar om AI-problem ska kunna rapporteras direkt till supporten.
const REPORTABLE_PATTERN = /\bai\b|utvärder|kriteri|analys|sammanfattning/i;

function isReportable(kindIsError: boolean, title: string, body?: string | null): boolean {
  return kindIsError && REPORTABLE_PATTERN.test(`${title} ${body ?? ''}`);
}

function notificationLooksError(type: string, title: string, body?: string | null): boolean {
  if (type.includes('error') || type.includes('failure') || type.includes('failed')) return true;
  return FAILURE_PATTERN.test(`${title} ${body ?? ''}`);
}

function supportReportRoute(title: string, body?: string | null): string {
  const message = `Jag vill rapportera ett problem med AI-funktionen.\n\nNotis: ${title}${body ? `\nDetaljer: ${body}` : ''}\nTidpunkt: ${new Date().toLocaleString('sv-SE')}\n\nBeskriv gärna vad du gjorde när det hände:\n`;
  return `/support?category=technical&message=${encodeURIComponent(message)}`;
}

function NotificationItem({
  notification,
  onRead,
  onNavigate
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onNavigate: (route: string) => void;
}) {
  const Icon = typeIcons[notification.type] || Bell;
  const colorClass = typeColors[notification.type] || 'text-white';
  const route = resolveRoute(notification.type, notification.metadata as Record<string, unknown> | null)
    ?? resolveToastRoute(notification.title, notification.body);

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: sv });

  const reportable = isReportable(notificationLooksError(notification.type, notification.title, notification.body), notification.title, notification.body) && !route;

  // Även informationsnotiser utan destination ska kunna markeras som lästa.
  // Saknas destination fäller trycket i stället ut hela texten i raden.
  const [expanded, setExpanded] = useState(false);
  const activate = () => {
    if (!notification.is_read) onRead(notification.id);
    if (route) onNavigate(route);
    else if (notification.body) setExpanded((value) => !value);
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-expanded={!route && notification.body ? expanded : undefined}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: notification.is_read ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={ROW_TRANSITION}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      className={ROW_CLASS}
    >
      <div className={`self-center flex h-6 w-6 shrink-0 aspect-square items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 ${colorClass}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <ClampTooltip text={notification.title}>
            <span className="text-sm font-medium text-white break-words leading-snug line-clamp-2">{notification.title}</span>
          </ClampTooltip>
          <UnreadDot visible={!notification.is_read} />
        </div>
        {notification.body && (
          <div className="mt-3">
            <ExpandableClamp expanded={expanded} className="text-xs text-white break-words">
              {notification.body}
            </ExpandableClamp>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] text-white">{timeAgo}</span>

          {reportable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!notification.is_read) onRead(notification.id);
                onNavigate(supportReportRoute(notification.title, notification.body));
              }}
              className="ml-auto inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
            >
              Rapportera
            </button>
          )}
        </div>
      </div>

    </motion.div>

  );
}


const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const toastTones = {
  success: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  error: 'bg-red-400/15 text-red-300 ring-red-400/30',
  warning: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
  info: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
} as const;

function ArchivedToastItem({ item, onRead, onNavigate }: { item: ArchivedToast; onRead: (id: string) => void; onNavigate: (route: string) => void }) {
  const Icon = toastIcons[item.kind] ?? Info;
  const timeAgo = formatDistanceToNow(new Date(item.at), { addSuffix: true, locale: sv });

  const route = item.route ?? resolveToastRoute(item.title, item.body);
  const reportable = isReportable(item.kind === 'error' || item.kind === 'warning', item.title, item.body) && !route;

  const [expanded, setExpanded] = useState(false);
  const activate = () => {
    if (!item.is_read) onRead(item.id);
    if (route) onNavigate(route);
    else if (item.body) setExpanded((value) => !value);
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-expanded={!route && item.body ? expanded : undefined}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: item.is_read ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={ROW_TRANSITION}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
      className={ROW_CLASS}
    >
      <span className={`self-center flex h-6 w-6 shrink-0 aspect-square items-center justify-center rounded-full ring-1 ${toastTones[item.kind] ?? toastTones.info}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <ClampTooltip text={item.title}>
            <span className="text-sm font-medium text-white break-words leading-snug line-clamp-2">{item.title}</span>
          </ClampTooltip>
          {item.count > 1 && (
            <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
              {item.count}×
            </span>
          )}
          <UnreadDot visible={!item.is_read} />
        </div>
        {item.body && (
          <div className="mt-3">
            <ExpandableClamp expanded={expanded} className="text-xs text-white break-words">
              {item.body}
            </ExpandableClamp>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] text-white">{timeAgo}</span>

          {reportable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!item.is_read) onRead(item.id);
                onNavigate(supportReportRoute(item.title, item.body));
              }}
              className="ml-auto inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
            >
              Rapportera
            </button>
          )}
        </div>
      </div>
    </motion.div>

  );
}


// Tekniska felnotiser hör hemma i loggarna – aldrig i kundens notiscenter.
const TECHNICAL_PATTERN = /backend-anrop|failed to fetch|appfel|misslyckat async|typeerror/i;

function isTechnical(title: string, body?: string | null): boolean {
  return TECHNICAL_PATTERN.test(`${title} ${body ?? ''}`);
}

// Kopplar notistyp till användarens inställning i profilen
const PREF_BY_NOTIFICATION_TYPE: Record<string, NotificationType> = {
  new_application: 'new_application',
  application_status: 'application_status',
  interview_scheduled: 'interview_scheduled',
  interview_reminder: 'interview_scheduled',
  message: 'new_message',
  new_message: 'new_message',
  message_reaction: 'new_message',
  job_expired: 'job_closed',
  job_closed: 'job_closed',
  saved_search_match: 'saved_search_match',
  saved_job_expiring: 'saved_job_expiring',
};

function NotificationCenter({ variant = 'round' }: { variant?: 'round' | 'rect' } = {}) {
  const {
    notifications,
    unreadCount: serverUnread,
    markAsRead,
    markAllAsRead,
    clearAll,
    hasMore,
    isLoadingMore,
    loadMore,
    hasError,
    refetch,
  } = useNotifications();
  const { isEnabled } = useNotificationPreferences();
  const archived = useSyncExternalStore(toastArchive.subscribe, toastArchive.getSnapshot, toastArchive.getSnapshot);

  const visibleNotifications = useMemo(() => notifications.filter(n => {
    if (isTechnical(n.title, n.body)) return false;
    const prefType = PREF_BY_NOTIFICATION_TYPE[n.type];
    if (prefType && !isEnabled(prefType, 'in_app')) return false;
    return true;
  }), [notifications, isEnabled]);

  const visibleArchived = useMemo(
    () => archived.filter(n => !isTechnical(n.title, n.body)),
    [archived]
  );

  // Räknaren måste spegla exakt det som visas i listan (efter dedupe),
  // annars kan badgen visa 2 medan listan bara har en rad.


  const merged = useMemo(() => {
    const a = visibleNotifications.map(n => {
      const at = new Date(n.created_at).getTime();
      // Toaster som synkats till kontot visas med toast-utseendet
      if (typeof n.type === 'string' && n.type.startsWith('toast_')) {
        const kind = n.type.slice(6) as ArchivedToast['kind'];
        const toast: ArchivedToast = {
          id: n.id,
          kind: (['success', 'info', 'warning', 'error'] as const).includes(kind) ? kind : 'info',
          title: n.title,
          body: n.body || undefined,
          at,
          count: Number(n.metadata?.count) > 1 ? Number(n.metadata.count) : 1,
          is_read: n.is_read,
          route: typeof n.metadata?.route === 'string' ? n.metadata.route : undefined,
        };
        return { kind: 'synced' as const, at, n: toast };
      }
      return { kind: 'server' as const, at, n };
    });
    const b = visibleArchived.map(n => ({ kind: 'local' as const, at: n.at, n }));
    // Dedupe: en notis som hunnit synkas till kontot kan fortfarande finnas kvar
    // lokalt (t.ex. om synken skedde i en annan flik). Visa den bara en gång.
    const all = [...a, ...b].sort((x, y) => y.at - x.at);
    const seen = new Map<string, number>();
    const DEDUPE_MS = 120_000;
    return all.filter(entry => {
      const title = (entry.n as { title?: string }).title || '';
      const body = (entry.n as { body?: string | null }).body || '';
      const key = `${title}|${body}`;
      const prev = seen.get(key);
      if (prev !== undefined && Math.abs(prev - entry.at) < DEDUPE_MS) return false;
      seen.set(key, entry.at);
      return true;
    });
  }, [visibleNotifications, visibleArchived]);

  const unreadCount = useMemo(() => {
    const loadedUnread = merged.filter((entry) => !(entry.n as { is_read?: boolean }).is_read).length;
    // Serversiffran vet om olästa som ligger utanför de laddade sidorna;
    // den lokala siffran fångar toaster som bara finns på den här enheten.
    return Math.max(loadedUnread, serverUnread);
  }, [merged, serverUnread]);

  // Vid "rensa"/"markera alla" hinner lokal och server-state gå isär i några
  // frames — utan spärren blinkar badgen till en felaktig siffra innan den
  // landar på noll.
  const [pendingClear, setPendingClear] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const displayCount = pendingClear ? 0 : unreadCount;

  useEffect(() => {
    if (!pendingClear) return;
    if (unreadCount === 0) { setPendingClear(false); return; }
    const t = window.setTimeout(() => setPendingClear(false), 4000);
    return () => window.clearTimeout(t);
  }, [pendingClear, unreadCount]);





  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canUsePortal = typeof document !== 'undefined';

  const handleOpenChange = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    // En påminnelse kan skapas precis efter att sidan laddats. Hämta därför
    // alltid färskt när klockan öppnas även om realtidsanslutningen hunnit blinka.
    if (nextOpen) void refetch();
  };

  // Ett tryck utanför panelen stänger den enbart — trycket får aldrig
  // nå knappen/länken under (t.ex. "Läs mer").
  useEffect(() => {
    if (!open) return;
    const isOutside = (target: EventTarget | null) =>
      !!panelRef.current && !panelRef.current.contains(target as Node) &&
      !!triggerRef.current && !triggerRef.current.contains(target as Node);
    let swallowUntil = 0;
    const swallowClick = (e: MouseEvent) => {
      if (Date.now() > swallowUntil) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      swallowUntil = 0;
    };
    const handler = (e: PointerEvent) => {
      if (!isOutside(e.target)) return;
      swallowUntil = Date.now() + 700;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', swallowClick, true);
    return () => {
      document.removeEventListener('pointerdown', handler, true);
      // Låt klickslukaren leva kvar under det korta fönstret efter stängning.
      window.setTimeout(() => document.removeEventListener('click', swallowClick, true), 750);
    };
  }, [open]);

  const handleNavigate = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  const triggerClass = variant === 'rect'
    ? 'relative flex items-center justify-center px-3 h-10 rounded-lg text-white [@media(hover:hover)]:hover:bg-white/10 transition-colors'
    : 'relative flex items-center justify-center h-[var(--icon-button-size-compact)] w-[var(--icon-button-size-compact)] shrink-0 aspect-square text-white bg-transparent active:bg-transparent focus:bg-transparent [@media(hover:hover)]:rounded-full [@media(hover:hover)]:hover:bg-white/10 transition-colors';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleOpenChange}
        className={triggerClass}
        aria-label="Notifikationer"
      >
        <Bell className="h-5 w-5" />
        <CountBadge count={displayCount} />

      </button>

      {canUsePortal && createPortal(<AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          // Öppnar med en mjuk fjäder uppifrån (som iOS-menyer); stängningen
          // behåller sin tidigare hopfällning.
          initial={{ opacity: 0, scale: 0.9, y: -12 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
              opacity: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
              default: { type: 'spring', stiffness: 460, damping: 34, mass: 0.8 },
            },
          }}
          exit={{ opacity: 0, scaleY: 0.08, y: -14, transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] } }}
          className="fixed z-[10000] w-[min(340px,calc(100vw-24px))] max-h-[min(70vh,600px)] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-xl p-0 overflow-hidden flex flex-col"
          style={{
            top: '60px',
            left: '50%',
            x: '-50%',
            transformOrigin: 'top center',
          }}
        >
          {/* Header */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Stäng notifikationer"
            onClick={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOpen(false);
              }
            }}
            className="flex cursor-pointer items-center justify-between px-4 py-3 border-b border-white/10 transition-colors pointer-fine:hover:bg-white/5"
          >
            <h3 className="text-sm font-semibold text-white">Notifikationer</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={(event) => { event.stopPropagation(); setPendingClear(true); markAllAsRead(); toastArchive.markAllAsRead(); }}
                  className="flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Markera alla som lästa
                </button>
              )}
              {merged.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpen(false);
                        setConfirmClearOpen(true);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-0 bg-red-500/80 text-white transition-colors md:hover:!bg-red-500 md:hover:!text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Rensa allt
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div
            className="overflow-y-auto flex-1 p-3"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={(e) => {
              if (!hasMore || isLoadingMore) return;
              const el = e.currentTarget;
              // Ladda nästa sida strax innan botten så att scrollen aldrig tar stopp.
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) void loadMore();
            }}
          >
            {merged.length === 0 && hasError ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-white">
                <AlertTriangle className="h-8 w-8 text-white" />
                <p className="text-sm text-center px-4">Kunde inte hämta notifikationerna.</p>
                <button
                  type="button"
                  onClick={() => { void refetch(); }}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
                >
                  Försök igen
                </button>
              </div>
            ) : merged.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white">
                <Bell className="h-8 w-8 mb-3 text-white" />
                <p className="text-sm">Inga notifikationer</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {merged.map(entry => entry.kind === 'server' ? (
                  <NotificationItem
                    key={`s-${entry.n.id}`}
                    notification={entry.n}
                    onRead={markAsRead}
                    onNavigate={handleNavigate}
                  />
                ) : (
                  <ArchivedToastItem
                    key={`${entry.kind === 'synced' ? 'y' : 'l'}-${entry.n.id}`}
                    item={entry.n}
                    onRead={entry.kind === 'synced' ? markAsRead : toastArchive.markAsRead}
                    onNavigate={handleNavigate}
                  />
                ))}

                {isLoadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>, document.body)}

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContentNoFocus
          elevated
          className="no-chrome-pad border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] max-h-[calc(100dvh-2rem)] overflow-visible p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Rensa alla notifikationer
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              Är du säker på att du vill ta bort alla notifikationer? Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setPendingClear(true); clearAll(); toastArchive.clear(); }}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </div>
  );
}

export default memo(NotificationCenter);
