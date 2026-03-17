import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { getMessageSenderName } from '@/lib/conversationDisplayUtils';
import { Briefcase, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ConversationMessage } from '@/hooks/useConversations';

interface MessageBubbleProps {
  message: ConversationMessage;
  isOwn: boolean;
  showAvatar: boolean;
  isGroup: boolean;
  currentUserRole: 'job_seeker' | 'employer' | null;
  /** Whether the other party has read this message */
  isRead?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isGroup,
  currentUserRole,
  isRead,
}: MessageBubbleProps) {
  const senderName = getMessageSenderName(message.sender_profile);

  // System message - job context switch marker
  if (message.is_system_message) {
    const isJobContextMarker = message.content.startsWith('📋');

    // Hide job context markers from job seekers
    if (isJobContextMarker && currentUserRole !== 'employer') {
      return null;
    }

    return (
      <div className="flex justify-center my-4">
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          isJobContextMarker
            ? "bg-blue-500/10 border border-blue-500/20"
            : "bg-white/5"
        )}>
          {isJobContextMarker && <Briefcase className="h-3.5 w-3.5 text-pure-white" />}
          <span className={cn(
            "text-xs font-medium",
            isJobContextMarker ? "text-pure-white" : "text-pure-white italic"
          )}>
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-2",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar space */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <ConversationAvatar
            profile={message.sender_profile}
            size="sm"
          />
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        "max-w-[70%] flex flex-col",
        isOwn ? "items-end" : "items-start"
      )}>
        {/* Sender name for group chats */}
        {isGroup && showAvatar && !isOwn && senderName !== 'Okänd' && (
          <span className="text-pure-white text-xs mb-1 ml-1">
            {senderName}
          </span>
        )}

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

        <div className={cn("flex items-center gap-1 mt-1 px-1", isOwn && "flex-row-reverse")}>
          <span className="text-pure-white text-[10px]">
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          {/* Read receipt for own messages */}
          {isOwn && !message.id.startsWith('temp-') && (
            isRead ? (
              <CheckCheck className="h-3 w-3 text-blue-400" />
            ) : (
              <Check className="h-3 w-3 text-pure-white" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
