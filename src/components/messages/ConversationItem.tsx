import { Skeleton } from '@/components/ui/skeleton';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { getConversationDisplayName, getConversationAvatarProfile } from '@/lib/conversationDisplayUtils';
import { Briefcase } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/hooks/useConversations';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: string;
  onClick: () => void;
  category: 'candidates' | 'colleagues';
}

export function ConversationItem({
  conversation,
  isSelected,
  currentUserId,
  onClick,
  category,
}: ConversationItemProps) {
  const otherMembers = (conversation.members || []).filter(m => m.user_id !== currentUserId);
  const displayMember = otherMembers[0];

  const snapshot = conversation.applicationSnapshot;

  const displayName = getConversationDisplayName({
    isGroup: conversation.is_group,
    groupName: conversation.name,
    snapshot,
    displayMember,
  });

  const avatarProfile = getConversationAvatarProfile(snapshot, displayMember);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Igår';
    return format(date, 'd MMM', { locale: sv });
  };

  const lastMessagePreview = conversation.last_message?.content || 'Inga meddelanden ännu';
  const isOwnMessage = conversation.last_message?.sender_id === currentUserId;

  const identityUnknown = displayName === 'Okänd användare';

  // Render entire row as skeleton when identity is unknown to prevent partial data flash
  if (identityUnknown) {
    return (
      <div className="w-full flex items-start gap-3 p-3 rounded-lg border border-transparent">
        <div className="relative flex-shrink-0">
          <Skeleton className="h-12 w-12 rounded-full bg-white/10" />
        </div>
        <div className="flex-1 min-w-0 space-y-2 pt-1">
          <Skeleton className="h-4 w-28 bg-white/10 rounded" />
          <Skeleton className="h-3 w-40 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all focus:outline-none focus-visible:outline-none",
        isSelected
          ? "bg-white/15 border border-white/20"
          : "md:hover:bg-white/10 border border-transparent"
      )}
      tabIndex={-1}
    >
      {/* Avatar with category indicator */}
      <div className="relative flex-shrink-0">
        <ConversationAvatar
          profile={avatarProfile}
          isGroup={conversation.is_group}
          groupName={conversation.name}
          size="lg"
          className={cn(
            "border-2",
            conversation.is_group
              ? ""
              : category === 'candidates'
                ? "border-emerald-500/50"
                : "border-blue-500/50"
          )}
          fallbackClassName="bg-white/10"
        />
        {conversation.unread_count > 0 && (
          <div className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            "font-medium truncate text-white",
            conversation.unread_count > 0 && "font-semibold"
          )}>
            {displayName}
          </span>
          <span className="text-pure-white text-xs flex-shrink-0">
            {formatTime(conversation.last_message_at)}
          </span>
        </div>

        {conversation.job && (
          <div className="flex items-center gap-1 text-pure-white text-xs mb-0.5">
            <Briefcase className="h-3 w-3" />
            <span className="truncate">{conversation.job.title}</span>
          </div>
        )}

        <p className={cn(
          "text-sm truncate",
          conversation.unread_count > 0 ? "text-pure-white font-medium" : "text-pure-white"
        )}>
          {isOwnMessage && <span className="text-pure-white">Du: </span>}
          {lastMessagePreview}
        </p>
      </div>
    </button>
  );
}
