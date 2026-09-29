import type { QueryClient } from '@tanstack/react-query';
import type { Conversation, ConversationMessage } from '@/hooks/useConversations';
import type { ConversationProfileData } from '@/types/conversation';

type ProfilePatch = ConversationProfileData & { user_id?: string };

function mergeProfile(
  current: ConversationProfileData | undefined,
  profile: ProfilePatch,
): ConversationProfileData {
  return {
    ...current,
    role: profile.role ?? current?.role,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    company_name: profile.company_name ?? null,
    profile_image_url: profile.profile_image_url ?? null,
    company_logo_url: profile.company_logo_url ?? null,
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