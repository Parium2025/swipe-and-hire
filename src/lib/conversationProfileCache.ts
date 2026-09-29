import type { QueryClient } from '@tanstack/react-query';
import type { Conversation, ConversationMessage } from '@/hooks/useConversations';
type ChatProfile = NonNullable<ConversationMessage['sender_profile']>;
type ProfilePatch = Partial<ChatProfile> & { user_id?: string };

function mergeProfile(
  current: ChatProfile | undefined,
  profile: ProfilePatch,
): ChatProfile | undefined {
  const role = profile.role ?? current?.role;
  if (!role) return current;
  return {
    role,
    first_name: profile.first_name !== undefined ? profile.first_name : current?.first_name ?? null,
    last_name: profile.last_name !== undefined ? profile.last_name : current?.last_name ?? null,
    company_name: profile.company_name !== undefined ? profile.company_name : current?.company_name ?? null,
    profile_image_url: profile.profile_image_url !== undefined ? profile.profile_image_url : current?.profile_image_url ?? null,
    company_logo_url: profile.company_logo_url !== undefined ? profile.company_logo_url : current?.company_logo_url ?? null,
  };
}

/** Uppdaterar all redan renderad chattdata för en sparad profil. */
export function patchConversationProfileCaches(
  queryClient: QueryClient,
  userId: string,
  profile: ProfilePatch,
): void {
  queryClient.setQueriesData<Conversation[]>({ queryKey: ['conversations'] }, (current) => {
    if (!current) return current;
    let changed = false;

    const next = current.map((conversation) => {
      let conversationChanged = false;
      const members = (conversation.members || []).map((member) => {
        if (member.user_id !== userId) return member;
        conversationChanged = true;
        return { ...member, profile: mergeProfile(member.profile, profile) };
      });

      const lastMessage = conversation.last_message?.sender_id === userId
        ? {
            ...conversation.last_message,
            sender_profile: mergeProfile(conversation.last_message.sender_profile, profile),
          }
        : conversation.last_message;

      if (lastMessage !== conversation.last_message) conversationChanged = true;
      if (!conversationChanged) return conversation;
      changed = true;
      return { ...conversation, members, last_message: lastMessage };
    });

    return changed ? next : current;
  });

  queryClient.setQueriesData<ConversationMessage[]>({ queryKey: ['conversation-messages'] }, (current) => {
    if (!current) return current;
    let changed = false;
    const next = current.map((message) => {
      if (message.sender_id !== userId) return message;
      changed = true;
      return { ...message, sender_profile: mergeProfile(message.sender_profile, profile) };
    });
    return changed ? next : current;
  });

  try {
    localStorage.removeItem('parium_conversations_cache');
  } catch {
    // Minnescachen är redan uppdaterad; blockerad lagring är inte fatal.
  }
}