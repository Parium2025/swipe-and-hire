import { memo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, Briefcase, UserCheck, Calendar, MessageCircle } from 'lucide-react';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
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
  new_application: 'text-emerald-400',
  application_status: 'text-blue-400',
  interview_scheduled: 'text-amber-400',
  message: 'text-purple-400',
  job_expired: 'text-red-400',
  saved_search_match: 'text-cyan-400',
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
  const colorClass = typeColors[notification.type] || 'text-white/60';
  const route = notification.metadata?.route as string | undefined;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: sv });

  return (
    <button
      onClick={() => {
        if (!notification.is_read) onRead(notification.id);
        if (route) onNavigate(route);
      }}
      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors rounded-lg ${
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
          <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <span className="text-[10px] text-white/40 mt-1 block">{timeAgo}</span>
      </div>
    </button>
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
        className="relative flex items-center justify-center h-9 w-9 rounded-lg text-white hover:bg-white/10 transition-colors"
        aria-label="Notifikationer"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white text-[9px] font-semibold flex items-center justify-center shadow-lg shadow-red-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[10000] w-[280px] max-h-[400px] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-xl p-0 overflow-hidden"
          style={{
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Notifikationer</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
                  title="Markera alla som lästa"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => clearAll()}
                  className="text-xs text-white/50 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
                  title="Rensa alla"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[340px] p-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white">
                <Bell className="h-8 w-8 mb-3 opacity-60" />
                <p className="text-sm">Inga notifikationer</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markAsRead}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(NotificationCenter);
