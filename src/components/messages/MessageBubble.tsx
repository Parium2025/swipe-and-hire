import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Message } from '@/hooks/useMessages';
import { SenderProfile, OptimisticMessage } from './types';

interface MessageBubbleProps {
  message: Message | OptimisticMessage;
  isOwn: boolean;
  showAvatar: boolean;
  senderProfile: SenderProfile;
}

export function MessageBubble({ 
  message, 
  isOwn, 
  showAvatar,
  senderProfile,
}: MessageBubbleProps) {
  const isOptimistic = 'isOptimistic' in message && message.isOptimistic;
  
  const getAvatarUrl = () => {
    if (senderProfile.role === 'employer' && senderProfile.company_logo_url) {
      return senderProfile.company_logo_url;
    }
    return senderProfile.profile_image_url;
  };

  const getInitials = () => {
    if (senderProfile.role === 'employer' && senderProfile.company_name) {
      return senderProfile.company_name.substring(0, 2).toUpperCase();
    }
    const first = senderProfile.first_name?.[0] || '';
    const last = senderProfile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  return (
    <div className={cn(
      "flex gap-2",
      isOwn ? "flex-row-reverse" : "flex-row",
      isOptimistic && "opacity-70"
    )}>
      {/* Avatar space */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <Avatar className="h-8 w-8 border border-white/10">
            <AvatarImage src={getAvatarUrl() || undefined} />
            <AvatarFallback className="bg-white/10 text-white text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        "max-w-[70%] flex flex-col",
        isOwn ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "px-4 py-2 rounded-2xl",
          isOwn 
            ? "bg-blue-500/30 border border-blue-500/40 rounded-br-md" 
            : "bg-white/10 border border-white/10 rounded-bl-md"
        )}>
          <p className="text-white text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        <span className="text-white text-[10px] mt-1 px-1">
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
}
