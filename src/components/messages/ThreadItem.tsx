import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Briefcase } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MessageThread } from './types';

interface ThreadItemProps {
  thread: MessageThread;
  currentUserId: string;
  onClick: () => void;
}

export function ThreadItem({ 
  thread, 
  currentUserId,
  onClick,
}: ThreadItemProps) {
  const profile = thread.senderProfile;
  
  const getDisplayName = () => {
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name;
    }
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Okänd';
  };

  const getAvatarUrl = () => {
    if (profile.role === 'employer' && profile.company_logo_url) {
      return profile.company_logo_url;
    }
    return profile.profile_image_url;
  };

  const getInitials = () => {
    if (profile.role === 'employer' && profile.company_name) {
      return profile.company_name.substring(0, 2).toUpperCase();
    }
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Igår';
    return format(date, 'd MMM', { locale: sv });
  };

  const lastMessage = thread.lastMessage;
  const isOwnMessage = lastMessage.sender_id === currentUserId;
  const hasUnread = thread.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all min-h-touch",
        "md:hover:bg-white/10 border border-transparent md:hover:border-white/10",
        "active:scale-[0.98] active:bg-white/10 active:border-white/10",
        hasUnread && "bg-white/5"
      )}
    >
      {/* Avatar with unread indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-14 w-14 border-2 border-white/10">
          <AvatarImage src={getAvatarUrl() || ''} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-white text-base" delayMs={150}>
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        {hasUnread && (
          <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1.5 border-2 border-slate-900">
            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={cn(
            "font-semibold truncate text-base",
            hasUnread ? "text-white" : "text-white/90"
          )}>
            {getDisplayName()}
          </span>
          <span className="text-white text-xs flex-shrink-0">
            {formatTime(lastMessage.created_at)}
          </span>
        </div>
        
        {/* Job context if available */}
        {lastMessage.job && (
          <div className="flex items-center gap-1.5 text-white text-xs mb-1">
            <Briefcase className="h-3 w-3 text-white" />
            <span className="truncate">{lastMessage.job.title}</span>
          </div>
        )}
        
        {/* Last message preview */}
        <p className={cn(
          "text-sm truncate text-white",
          hasUnread && "font-medium"
        )}>
          <span className="text-white">
            {isOwnMessage ? "Du: " : `${getDisplayName()}: `}
          </span>
          {lastMessage.content}
        </p>
      </div>

      {/* Chevron indicator */}
      <ChevronLeft className="h-5 w-5 text-white rotate-180 flex-shrink-0" />
    </button>
  );
}
