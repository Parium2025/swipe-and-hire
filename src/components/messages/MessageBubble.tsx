import { useState, useRef } from 'react';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { getMessageSenderName } from '@/lib/conversationDisplayUtils';
import { Briefcase, Check, CheckCheck, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ConversationMessage } from '@/hooks/useConversations';
import type { GroupedReaction } from '@/hooks/useMessageReactions';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏'];

interface MessageBubbleProps {
  message: ConversationMessage;
  isOwn: boolean;
  showAvatar: boolean;
  isGroup: boolean;
  currentUserRole: 'job_seeker' | 'employer' | null;
  /** Whether the other party has read this message */
  isRead?: boolean;
  /** Grouped reactions for this message */
  reactions?: GroupedReaction[];
  /** Toggle a reaction on this message */
  onToggleReaction?: (emoji: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isGroup,
  currentUserRole,
  isRead,
  reactions = [],
  onToggleReaction,
}: MessageBubbleProps) {
  const senderName = getMessageSenderName(message.sender_profile);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowEmojiPicker(true);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleReaction = (emoji: string) => {
    onToggleReaction?.(emoji);
    setShowEmojiPicker(false);
  };

  // System message - job context switch marker
  if (message.is_system_message) {
    const isJobContextMarker = message.content.startsWith('📋');

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

  const hasAttachment = message.attachment_url && message.attachment_type;

  const renderAttachment = () => {
    if (!hasAttachment) return null;

    const isImage = message.attachment_type?.startsWith('image/');

    if (isImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden max-w-[240px]">
          <img
            src={message.attachment_url!}
            alt={message.attachment_name || 'Bild'}
            className="w-full h-auto rounded-lg"
            loading="lazy"
          />
        </div>
      );
    }

    // File attachment
    return (
      <a
        href={message.attachment_url!}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 md:hover:bg-white/10 transition-colors"
      >
        {message.attachment_type?.includes('pdf') ? (
          <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
        ) : (
          <Paperclip className="h-4 w-4 text-pure-white flex-shrink-0" />
        )}
        <span className="text-sm text-pure-white truncate">
          {message.attachment_name || 'Fil'}
        </span>
      </a>
    );
  };

  return (
    <div
      className={cn("flex gap-2 relative group", isOwn ? "flex-row-reverse" : "flex-row")}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
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
          {message.content && (
            <p className="text-white text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          {renderAttachment()}
        </div>

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn && "justify-end")}>
            {reactions.map(({ emoji, count, hasOwn }) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction?.(emoji)}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all active:scale-95",
                  hasOwn
                    ? "bg-blue-500/30 border border-blue-500/40"
                    : "bg-white/10 border border-white/10 md:hover:bg-white/15"
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-pure-white text-[10px]">{count}</span>}
              </button>
            ))}
          </div>
        )}

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

          {/* Emoji add button (desktop hover) */}
          {!message.id.startsWith('temp-') && onToggleReaction && (
            <button
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-pure-white md:hover:text-white text-xs"
              aria-label="Lägg till reaktion"
            >
              😊
            </button>
          )}
        </div>

        {/* Quick emoji picker */}
        {showEmojiPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
            <div className={cn(
              "absolute z-50 flex gap-1 p-1.5 rounded-full bg-black/80 border border-white/20 backdrop-blur-md shadow-xl",
              isOwn ? "right-0" : "left-10",
              "bottom-full mb-1"
            )}>
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-full md:hover:bg-white/20 active:scale-90 transition-all text-base"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
