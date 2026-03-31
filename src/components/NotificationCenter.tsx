import { memo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Trash2, Briefcase, UserCheck, Calendar, MessageCircle } from 'lucide-react';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
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
};

const typeColors: Record<string, string> = {
  new_application: 'text-white',
  application_status: 'text-white',
  interview_scheduled: 'text-white',
  message: 'text-white',
  job_expired: 'text-white',
  saved_search_match: 'text-white',
};

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
  const route = notification.metadata?.route as string | undefined;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: sv });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (!notification.is_read) onRead(notification.id);
            if (route) onNavigate(route);
          }}
          className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors rounded-lg ${
            notification.is_read 
              ? 'opacity-60 hover:bg-white/5' 
              : 'hover:bg-white/10 bg-white/5'
          }`}
        >
          <div className={`mt-0.5 shrink-0 ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{notification.title}</span>
              {!notification.is_read && (
                <span className="shrink-0 h-2 w-2 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm shadow-red-500/30" />
              )}
            </div>
            {notification.body && (
              <p className="text-xs text-white mt-0.5 line-clamp-2">{notification.body}</p>
            )}
            <span className="text-[10px] text-white mt-1 block">{timeAgo}</span>
          </div>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[240px] text-xs">
        <p className="font-medium">{notification.title}</p>
        {notification.body && <p className="mt-1 opacity-80">{notification.body}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
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

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center h-[var(--icon-button-size-compact)] w-[var(--icon-button-size-compact)] shrink-0 aspect-square rounded-full text-white hover:bg-white/10 transition-colors"
        aria-label="Notifikationer"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white text-[9px] font-semibold flex items-center justify-center shadow-lg shadow-red-500/30">
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
          className="fixed z-[10000] w-[280px] max-h-[min(70vh,600px)] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-xl p-0 overflow-hidden flex flex-col"
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
                      onClick={() => markAllAsRead()}
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
              {notifications.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => clearAll()}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-destructive/40 bg-destructive/20 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Rensa alla
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1 p-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white">
                <Bell className="h-8 w-8 mb-3 opacity-60" />
                <p className="text-sm">Inga notifikationer</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onRead={markAsRead}
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
