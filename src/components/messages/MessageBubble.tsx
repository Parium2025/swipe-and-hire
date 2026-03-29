import { useState, useRef, useCallback } from 'react';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { EmojiReactionPicker } from '@/components/messages/EmojiReactionPicker';
import { getMessageSenderName } from '@/lib/conversationDisplayUtils';
import { Briefcase, Check, CheckCheck, Paperclip, FileText, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTouchCapable } from '@/hooks/useInputCapability';
import type { ConversationMessage } from '@/hooks/useConversations';
import type { GroupedReaction } from '@/hooks/useMessageReactions';

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
  /** Trigger edit mode for this message */
  onEdit?: (messageId: string, currentContent: string) => void;
}

/** Check if a message has been explicitly edited by the user */
function isEdited(message: ConversationMessage): boolean {
  return !!message.edited_at;
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
  onEdit,
}: MessageBubbleProps) {
  const senderName = getMessageSenderName(message.sender_profile);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const lastTapRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const isTouch = useTouchCapable();

  const isTemp = message.id.startsWith('temp-');
  const canEdit = isOwn && !isTemp && !message.is_system_message && !!onEdit;
  const edited = isEdited(message);

  const openEmojiPicker = useCallback(() => {
    if (!onToggleReaction || isTemp) return;
    if (bubbleRef.current) {
      setAnchorRect(bubbleRef.current.getBoundingClientRect());
      setShowEmojiPicker(true);
    }
  }, [onToggleReaction, isTemp]);

  // Long-press for touch devices (like iMessage)
  const handleTouchStart = useCallback(() => {
    if (!isTouch) return;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      openEmojiPicker();
    }, 500);
  }, [isTouch, openEmojiPicker]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Double-click for mouse users
  const handleDoubleClick = useCallback(() => {
    if (isTouch) return;
    openEmojiPicker();
  }, [isTouch, openEmojiPicker]);

  const handleReaction = (emoji: string) => {
    onToggleReaction?.(emoji);
  };

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canEdit) {
      onEdit!(message.id, message.content);
    }
  }, [canEdit, onEdit, message.id, message.content]);

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
    const isVideo = message.attachment_type?.startsWith('video/');

    if (isImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden max-w-[240px]">
          <img
            src={message.attachment_url!}
            alt={message.attachment_name || 'Bild'}
            className="w-full h-auto rounded-lg bg-white/5"
            loading="lazy"
            style={{ aspectRatio: '4/3', objectFit: 'cover' }}
            onLoad={(e) => {
              (e.target as HTMLImageElement).style.aspectRatio = '';
              (e.target as HTMLImageElement).style.objectFit = '';
            }}
          />
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden max-w-[240px]">
          <video
            src={message.attachment_url!}
            className="w-full h-auto rounded-lg bg-white/5"
            style={{ aspectRatio: '16/9', objectFit: 'cover' }}
            preload="metadata"
            playsInline
            controls
            controlsList="nodownload"
          >
            <track kind="captions" />
          </video>
          {message.attachment_name && (
            <p className="text-pure-white text-xs mt-1 truncate px-1">
              {message.attachment_name}
            </p>
          )}
        </div>
      );
    }

    // File attachment (PDF, docs, etc.)
    return (
      <a
        href={message.attachment_url!}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 md:hover:bg-white/10 transition-colors min-h-touch"
      >
        {message.attachment_type?.includes('pdf') ? (
          <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
        ) : (
          <Paperclip className="h-4 w-4 text-pure-white flex-shrink-0" />
        )}
        <span className="text-sm text-pure-white truncate break-words [overflow-wrap:anywhere]">
          {message.attachment_name || 'Fil'}
        </span>
      </a>
    );
  };

  return (
    <>
      <div
        className={cn("flex gap-2 relative group", isOwn ? "flex-row-reverse" : "flex-row")}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
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

          <div className="relative">
            <div
              ref={bubbleRef}
              className={cn(
                "px-4 py-2 rounded-2xl select-none",
                isOwn
                  ? "bg-blue-500/30 border border-blue-500/40 rounded-br-md"
                  : "bg-white/10 border border-white/10 rounded-bl-md"
              )}
            >
              {message.content && (
                <p className="text-white text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
              {renderAttachment()}
            </div>

            {/* Edit button - visible on hover (desktop) */}
            {canEdit && (
              <button
                onClick={handleEdit}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full",
                  "bg-white/10 border border-white/10 text-pure-white",
                  "opacity-0 group-hover:opacity-100 md:hover:bg-white/20",
                  "transition-all active:scale-90",
                  isOwn ? "-left-8" : "-right-8"
                )}
                aria-label="Redigera meddelande"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Reactions display */}
          {reactions.length > 0 && (
            <div className={cn("flex flex-wrap gap-1 mt-1", isOwn && "justify-end")}>
              {reactions.map(({ emoji, count, hasOwn }) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); onToggleReaction?.(emoji); }}
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
            {/* Edited indicator */}
            {edited && message.edited_at && (
              <span className="text-pure-white text-[10px] italic">
                redigerat {format(new Date(message.edited_at), 'HH:mm')}
              </span>
            )}
            {/* Read receipt for own messages */}
            {isOwn && !isTemp && (
              isRead ? (
                <CheckCheck className="h-3 w-3 text-blue-400" />
              ) : (
                <Check className="h-3 w-3 text-pure-white" />
              )
            )}
          </div>
        </div>
      </div>

      {/* Emoji Reaction Picker - portal-like, rendered outside bubble */}
      <EmojiReactionPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleReaction}
        isOwn={isOwn}
        anchorRect={anchorRect}
      />
    </>
  );
}
