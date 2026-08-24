import { memo, useState, useRef, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Trash2, Briefcase, UserCheck, Calendar, MessageCircle, UserX, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { toastArchive, type ArchivedToast } from '@/lib/toastArchive';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { useNotificationPreferences, type NotificationType } from '@/hooks/useNotificationPreferences';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

const typeIcons: Record<string, typeof Bell> = {
  new_application: UserCheck,
  application_status: Briefcase,
  interview_scheduled: Calendar,
  message: MessageCircle,
  job_expired: Briefcase,
  saved_search_match: Bell,
  candidate_deleted: UserX,
};


const typeColors: Record<string, string> = {
  new_application: 'text-white',
  application_status: 'text-white',
  interview_scheduled: 'text-white',
  message: 'text-white',
  job_expired: 'text-white',
  saved_search_match: 'text-white',
  candidate_deleted: 'text-white',
};


function useTruncation<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return truncated;
}

// Notiser saknar ofta en explicit route i metadata (t.ex. chattnotiser som bara
// bär conversation_id). Här härleds målet så att varje notis alltid går att klicka på.
function resolveRoute(type: string, metadata?: Record<string, unknown> | null): string | undefined {
  const explicit = typeof metadata?.route === 'string' ? metadata.route : undefined;
  if (explicit) return explicit;

  const conversationId = metadata?.conversation_id;
  if (typeof conversationId === 'string' && conversationId) {
    return `/messages?conversation=${conversationId}`;
  }

  const jobId = typeof metadata?.job_id === 'string' ? metadata.job_id : undefined;

  switch (type) {
    case 'message':
    case 'new_message':
      return '/messages';
    case 'new_application':
      return jobId ? `/job-details/${jobId}` : '/candidates';
    case 'application_status':
      return '/my-applications';
    case 'interview_scheduled':
    case 'interview_reminder':
      return '/my-candidates';
    case 'job_expired':
    case 'job_closed':
      return '/my-jobs';
    case 'saved_search_match':
      return '/search-jobs';
    case 'saved_job_expiring':
      return '/saved-jobs';
    default:
      return undefined;
  }
}

// Notiser som handlar om AI-problem ska kunna rapporteras direkt till supporten.
const REPORTABLE_PATTERN = /\bai\b|utvärder|kriteri|analys|sammanfattning/i;

function isReportable(kindIsError: boolean, title: string, body?: string | null): boolean {
  return kindIsError && REPORTABLE_PATTERN.test(`${title} ${body ?? ''}`);
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
  const route = resolveRoute(notification.type, notification.metadata as Record<string, unknown> | null);

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: sv });

  const titleRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const titleTruncated = useTruncation(titleRef);
  const bodyTruncated = useTruncation(bodyRef);
  const [expanded, setExpanded] = useState(false);
  const canExpand = titleTruncated || bodyTruncated || expanded;
  const reportable = isReportable(true, notification.title, notification.body) && !route;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (!notification.is_read) onRead(notification.id);
        if (route) { onNavigate(route); return; }
        if (canExpand) setExpanded(v => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!notification.is_read) onRead(notification.id);
          if (route) { onNavigate(route); return; }
          if (canExpand) setExpanded(v => !v);
        }
      }}
      className={`w-full flex items-start gap-5 px-5 py-5 text-left transition-colors rounded-xl cursor-pointer ${
        notification.is_read 
          ? 'opacity-60 hover:bg-white/5' 
          : 'hover:bg-white/10 bg-white/5'
      }`}
    >
      <div className={`self-center flex h-6 w-6 shrink-0 aspect-square items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 ${colorClass}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span ref={titleRef} className={`text-sm font-medium text-white break-words leading-snug ${expanded ? '' : 'line-clamp-2'}`}>{notification.title}</span>
          {!notification.is_read && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm shadow-red-500/30" />
          )}
        </div>
        {notification.body && (
          <p ref={bodyRef} className={`text-xs text-white mt-3 break-words ${expanded ? '' : 'line-clamp-2'}`}>{notification.body}</p>
        )}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] text-white">{timeAgo}</span>
          {!route && canExpand && (
            <span className="text-xs font-medium text-white/80 underline underline-offset-2">
              {expanded ? 'Visa mindre' : 'Visa mer'}
            </span>
          )}
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

  const titleRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const titleTruncated = useTruncation(titleRef);
  const bodyTruncated = useTruncation(bodyRef);
  const [expanded, setExpanded] = useState(false);
  const canExpand = titleTruncated || bodyTruncated || expanded;
  const reportable = isReportable(item.kind === 'error' || item.kind === 'warning', item.title, item.body) && !item.route;

  const activate = () => {
    if (!item.is_read) onRead(item.id);
    if (item.route) { onNavigate(item.route); return; }
    if (canExpand) setExpanded(v => !v);
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      whileTap={{ scale: 0.98 }}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      }}
      className={`w-full flex items-start gap-5 px-5 py-5 text-left transition-colors rounded-xl cursor-pointer ${
        item.is_read ? 'opacity-60 hover:bg-white/5' : 'hover:bg-white/10 bg-white/5'
      }`}
    >
      <span className={`self-center flex h-6 w-6 shrink-0 aspect-square items-center justify-center rounded-full ring-1 ${toastTones[item.kind] ?? toastTones.info}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span ref={titleRef} className={`text-sm font-medium text-white break-words leading-snug ${expanded ? '' : 'line-clamp-2'}`}>{item.title}</span>
          {item.count > 1 && (
            <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
              {item.count}×
            </span>
          )}
          {!item.is_read && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm shadow-red-500/30" />
          )}
        </div>
        {item.body && <p ref={bodyRef} className={`text-xs text-white mt-3 break-words ${expanded ? '' : 'line-clamp-2'}`}>{item.body}</p>}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] text-white">{timeAgo}</span>
          {!item.route && canExpand && (
            <span className="text-xs font-medium text-white/80 underline underline-offset-2">
              {expanded ? 'Visa mindre' : 'Visa mer'}
            </span>
          )}
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
  job_expired: 'job_closed',
  job_closed: 'job_closed',
  saved_search_match: 'saved_search_match',
  saved_job_expiring: 'saved_job_expiring',
};

function NotificationCenter({ variant = 'round' }: { variant?: 'round' | 'rect' } = {}) {
  const { notifications, unreadCount: serverUnread, markAsRead, markAllAsRead, clearAll } = useNotifications();
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

  const unreadCount = useMemo(
    () => merged.filter((entry) => !(entry.n as { is_read?: boolean }).is_read).length,
    [merged],
  );



  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNavigate = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  const triggerClass = variant === 'rect'
    ? 'relative flex items-center justify-center px-3 h-10 rounded-lg text-white hover:bg-white/10 transition-colors'
    : 'relative flex items-center justify-center h-[var(--icon-button-size-compact)] w-[var(--icon-button-size-compact)] shrink-0 aspect-square rounded-full text-white hover:bg-white/10 transition-colors';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        className={triggerClass}
        aria-label="Notifikationer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white text-[10px] font-semibold flex items-center justify-center shadow-lg shadow-red-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[10000] w-[min(340px,calc(100vw-24px))] max-h-[min(70vh,600px)] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-xl p-0 overflow-hidden flex flex-col"
          style={{
            top: '60px',
            left: '50%',
            x: '-50%',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Notifikationer</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { markAllAsRead(); toastArchive.markAllAsRead(); }}
                      className="flex items-center justify-center h-7 w-7 rounded-full text-white hover:bg-white/10 transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Markera alla som lästa
                  </TooltipContent>
                </Tooltip>
              )}
              {merged.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { clearAll(); toastArchive.clear(); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
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
          <div className="overflow-y-auto flex-1 p-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {merged.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white">
                <Bell className="h-8 w-8 mb-3 text-white" />
                <p className="text-sm">Inga notifikationer</p>
              </div>
            ) : (
              <div className="space-y-2">
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

              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

export default memo(NotificationCenter);
