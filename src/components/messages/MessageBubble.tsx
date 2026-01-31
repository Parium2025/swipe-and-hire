import { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Message } from '@/hooks/useMessages';
import { SenderProfile, OptimisticMessage } from './types';
import { MessageAttachmentDisplay } from './MessageAttachmentDisplay';
import { MessageReactions } from './MessageReactions';
import { EmojiReactionPicker } from './EmojiReactionPicker';
import { LinkPreviewCard } from './LinkPreviewCard';
import { MessageAvatar } from './MessageAvatar';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { extractUrls } from '@/hooks/useLinkPreview';
import { Clock } from 'lucide-react';

interface MessageBubbleProps {
  message: Message | OptimisticMessage;
  isOwn: boolean;
  showAvatar: boolean;
  senderProfile: SenderProfile;
  currentUserId: string;
}

export function MessageBubble({ 
  message, 
  isOwn, 
  showAvatar,
  senderProfile,
  currentUserId,
}: MessageBubbleProps) {
  const isOptimistic = 'isOptimistic' in message && message.isOptimistic;
  const isQueued = message.id.startsWith('offline-');
  
  // Only fetch reactions for real messages
  const { groupedReactions, toggleReaction } = useMessageReactions(
    isOptimistic ? '' : message.id, 
    currentUserId
  );

  // Extract URLs from message content for link previews
  const urls = useMemo(() => {
    if (!message.content || isOptimistic || isQueued) return [];
    return extractUrls(message.content);
  }, [message.content, isOptimistic, isQueued]);

  // Only show preview for first URL to avoid clutter
  const previewUrl = urls.length > 0 ? urls[0] : null;

  // Check for attachment (type assertion for extended Message type)
  const attachment = (message as any).attachment_url ? {
    url: (message as any).attachment_url,
    type: (message as any).attachment_type || 'document',
    name: (message as any).attachment_name || 'Bilaga',
  } : null;

  return (
    <div className={cn(
      "flex gap-2 group",
      isOwn ? "flex-row-reverse" : "flex-row",
      (isOptimistic || isQueued) && "opacity-70"
    )}>
      {/* Avatar space */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <MessageAvatar senderProfile={senderProfile} size="sm" />
        )}
      </div>

      {/* Message content */}
      <div className={cn(
        "max-w-[70%] flex flex-col",
        isOwn ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "flex items-center gap-1",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}>
          <div className="flex flex-col">
            {/* Attachment if present */}
            {attachment && (
              <div className="mb-2">
                <MessageAttachmentDisplay
                  url={attachment.url}
                  type={attachment.type}
                  name={attachment.name}
                  isOwn={isOwn}
                />
              </div>
            )}

            {/* Text content */}
            {message.content && (
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
            )}

            {/* Link preview */}
            {previewUrl && (
              <LinkPreviewCard url={previewUrl} isOwn={isOwn} />
            )}
          </div>

          {/* Emoji reaction picker - only for real messages */}
          {!isOptimistic && !isQueued && (
            <EmojiReactionPicker 
              onSelect={toggleReaction}
              isOwn={isOwn}
            />
          )}
        </div>

        {/* Reactions display */}
        {!isOptimistic && groupedReactions.length > 0 && (
          <MessageReactions 
            reactions={groupedReactions}
            onToggle={toggleReaction}
            isOwn={isOwn}
          />
        )}

        <div className="flex items-center gap-1 mt-1 px-1">
          {isQueued && (
            <Clock className="h-3 w-3 text-amber-400" />
          )}
          <span className="text-white text-[10px]">
            {isQueued ? 'Väntar...' : format(new Date(message.created_at), 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
